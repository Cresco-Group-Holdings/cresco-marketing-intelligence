# Resend Provider — Operations Runbook (Task 7.2)

> Last reviewed: **2026-08-01**.
>
> Day-2 operations procedures for the Resend email provider integration.

## Quick reference

| Item | Value |
|------|-------|
| Provider key | `resend` |
| API base | `https://api.resend.com` |
| Webhook URL | `{WEBHOOK_BASE_URL}/resend` |
| Default rate limit | 10 req/s per team |
| Send max recipients | 50 per email |
| Batch max | 100 emails per batch |
| Idempotency TTL | 24 hours |
| Request timeout | 30 seconds |
| Webhook timestamp tolerance | 5 minutes |
| Circuit breaker threshold | 5 consecutive failures |

## Monitoring

### Health indicators

| Signal | Source | Healthy | Degraded | Unhealthy |
|--------|--------|---------|----------|-----------|
| Connection status | `ProviderConnection.status` | `CONNECTED` | `DEGRADED` | `REAUTH_REQUIRED`, `ERROR` |
| Health state | `ProviderHealthState.status` | `HEALTHY` | `DEGRADED` | `UNHEALTHY` |
| Circuit breaker | `ProviderHealthState.circuitState` | `CLOSED` | `HALF_OPEN` | `OPEN` |
| Last successful send | `ProviderConnection.lastSuccessfulAt` | < 1 hour ago | < 24 hours | > 24 hours or null |
| Domain verification | `configuration.domainCount` | verified > 0 | pending domains | failed domains |

### Key metrics to track

| Metric | Query / source | Alert threshold |
|--------|---------------|-----------------|
| Send acceptance rate | `EMAIL_SEND_ACCEPTED` / `EMAIL_SEND_ATTEMPTED` audit ratio | < 95% over 1h |
| Send failure rate | `EMAIL_SEND_REJECTED` count | > 10/hour |
| Rate limit hits | `RATE_LIMIT_REACHED` audit events | > 5/hour |
| Webhook rejection rate | `WEBHOOK_REJECTED` / total webhooks | > 1% |
| Bounce rate | `EMAIL_BOUNCED` / `EMAIL_DELIVERED` | > 5% |
| Complaint rate | `EMAIL_COMPLAINED` / `EMAIL_DELIVERED` | > 0.1% |
| Circuit breaker opens | `circuitState: OPEN` | Any occurrence |
| Emergency shutdown | `EMAIL_EMERGENCY_SHUTDOWN=true` | Any occurrence |

### Resend dashboard

Monitor in parallel at [resend.com/logs](https://resend.com/logs):

- Delivery status breakdown
- 429 rate limit responses (filter `status=429`)
- Bounce and complaint trends
- Domain verification status
- API key usage per key

## Routine operations

### Daily

1. Review send failure audit events (`EMAIL_SEND_REJECTED`).
2. Check bounce/complaint rates in Resend dashboard.
3. Verify no connections in `REAUTH_REQUIRED` status.
4. Confirm webhook processing (no backlog of `VERIFIED` events stuck unprocessed).

### Weekly

1. Review domain verification status for all active connections.
2. Check API key last-used dates in Resend; delete unused keys.
3. Review suppression list growth (`EmailSuppression` count per org).
4. Validate `PROVIDER_LIVE_CALLS_ENABLED` is `false` in Preview.

### Monthly

1. Review DMARC aggregate reports (if `rua` configured).
2. Audit active connections and credential fingerprints.
3. Test emergency shutdown procedure in staging.
4. Review rate limit headroom on [Settings → Usage](https://resend.com/settings/usage).

## Connection test

### Automated (API)

```http
POST /api/providers/connections/{connectionId}/test
x-organisation-id: <org-id>
```

**Expected response:**

```json
{
  "connected": true,
  "domainCount": 2,
  "verifiedDomainCount": 1,
  "health": "HEALTHY"
}
```

### Manual verification

1. Confirm API key is valid in Resend dashboard (key shows recent activity).
2. Run connection test via Integrations UI.
3. Send test email to `delivered@resend.dev` (sandbox) or verified domain.
4. Confirm webhook `email.sent` → `email.delivered` received and processed.

## Domain refresh

```http
GET /api/providers/connections/{connectionId}/domains
x-organisation-id: <org-id>
```

Updates `domainsLastCheckedAt` and `domainCount` in connection configuration.

**When to run:**

- After DNS changes
- After `domain.updated` webhook
- When sends fail with `DOMAIN_NOT_VERIFIED`
- Before enabling `live_sending` for a connection

## Incident response

### P1: Runaway / unauthorized sending

**Symptoms:** Unexpected volume spike, Resend quota alerts, user reports.

**Response:**

1. Set `EMAIL_EMERGENCY_SHUTDOWN=true` immediately.
2. Revoke affected connection: `POST /api/providers/connections/{id}/revoke`.
3. Delete API key in Resend dashboard.
4. Review `ProviderAuditEvent` for `EMAIL_SEND_ACCEPTED` entries.
5. Check `ProviderOutboundSend` for recent sends.
6. Notify affected tenants.
7. Post-incident: rotate `ENCRYPTION_KEY` if credential leak suspected.

### P1: Credential compromise

**Symptoms:** Unknown API activity in Resend logs, key found in public repo.

**Response:**

1. `EMAIL_EMERGENCY_SHUTDOWN=true`.
2. Delete compromised key in Resend dashboard.
3. Revoke all credentials for affected connection.
4. Issue new key with `sending_access` + domain scope.
5. Reconnect via setup guide.
6. Review audit trail for unauthorized sends.

### P2: All sends failing (401/403)

**Symptoms:** `AUTHENTICATION_REQUIRED` or `INVALID_CREDENTIALS` on all sends.

**Response:**

1. Test connection via API.
2. If failed → key revoked/expired in Resend. Tenant must provide new key.
3. Update connection status will be `REAUTH_REQUIRED`.
4. After reconnect, verify with test send.

### P2: Domain not verified

**Symptoms:** `DOMAIN_NOT_VERIFIED` rejections.

**Response:**

1. Check domain status in Resend dashboard.
2. Run domain refresh in Cresco.
3. Verify DNS records (SPF, DKIM) with `dig` or DNS provider.
4. For `temporary_failure`, restore DNS within 72 hours.
5. Resend from verified domain or use `resend.dev` for testing.

### P2: Rate limiting (429)

**Symptoms:** `RATE_LIMIT_REACHED` audit events, send delays.

**Response:**

1. Check `retry-after` header value in logs.
2. Circuit breaker may open after 5 consecutive failures.
3. Reduce concurrent send rate (stay under 10 req/s).
4. For sustained high volume, request rate increase from Resend support.
5. Consider migrating batch sends to native `POST /emails/batch` (single API call).

**Rate limit headers:**

| Header | Meaning |
|--------|---------|
| `ratelimit-limit` | Max requests per window |
| `ratelimit-remaining` | Requests left |
| `ratelimit-reset` | Seconds until reset |
| `retry-after` | Seconds to wait (on 429) |

### P2: Webhook delivery failures

**Symptoms:** Events in Resend dashboard show failed deliveries; missing `EmailDeliveryEvent` records.

**Response:**

1. Verify webhook URL is reachable: `curl -X POST {WEBHOOK_BASE_URL}/resend`.
2. Check `WEBHOOK_REJECTED` audit events for error codes:
   - `SIGNATURE_INVALID` → webhook secret mismatch; re-store `WEBHOOK_SIGNING_SECRET`.
   - `TIMESTAMP_OUT_OF_TOLERANCE` → clock skew; check server NTP.
   - `CONNECTION_NOT_RESOLVED` → no matching endpoint/secret.
3. Replay failed events from Resend dashboard.
4. Confirm firewall allows Resend webhook IPs.

### P3: High bounce rate

**Symptoms:** Elevated `EMAIL_BOUNCED` events.

**Response:**

1. Check bounce types in `safeMetadata.bounceType`.
2. Permanent bounces auto-suppress in Cresco.
3. Review list quality (stale addresses, typos).
4. Check domain reputation in Resend dashboard.
5. Verify SPF/DKIM/DMARC passing.

### P3: High complaint rate

**Symptoms:** `EMAIL_COMPLAINED` events increasing.

**Response:**

1. Recipients auto-suppressed on complaint.
2. Review email content and frequency.
3. Confirm marketing sends have proper consent.
4. Check unsubscribe mechanism.
5. Pause marketing sends if complaint rate exceeds 0.1%.

### P3: Circuit breaker open

**Symptoms:** Sends rejected with "Provider circuit breaker is open."

**Response:**

1. Check `ProviderHealthState` for the connection.
2. Identify root cause (rate limits, auth failures, provider outage).
3. Circuit resets after `PROVIDER_CIRCUIT_RESET_MS` (60 seconds) to `HALF_OPEN`.
4. Successful send closes circuit.
5. Fix underlying issue before retry storm.

## Webhook replay procedure

Resend supports manual webhook replay from the dashboard.

1. Navigate to **Webhooks** → select endpoint → event details.
2. Click **Replay**.
3. Cresco deduplicates on `svix-id` — replays with the **same** `svix-id` return `200 Duplicate event`.
4. To force reprocessing, Resend must generate a new delivery (contact Resend support or re-trigger the event).

For backfill after outage:

1. Fix webhook endpoint.
2. Replay failed events from Resend dashboard (last 7 days available).
3. Monitor `ProviderWebhookEvent` for `PROCESSED` status.
4. Compare Resend send log against Cresco `EmailDeliveryEvent` for gaps.

## Credential rotation

### API key rotation

1. Create new API key in Resend (same permission/domain scope).
2. Connect with new key (or update credential via connect flow).
3. Test connection and send.
4. Delete old key in Resend dashboard.
5. Verify audit shows `CREDENTIAL_REVOKED` for old credential.

### Webhook secret rotation

1. Create new webhook in Resend (or rotate secret if supported).
2. Store new `WEBHOOK_SIGNING_SECRET` in Cresco.
3. Deactivate old webhook endpoint record.
4. Send test email; verify signature passes.
5. Delete old webhook in Resend.

## Scaling guidance

| Volume | Recommendation |
|--------|---------------|
| < 10 sends/s | Direct API calls sufficient |
| 10–50 sends/s | Request rate limit increase; implement send queue |
| > 50 sends/s | Queue + worker; native batch endpoint; multiple connections per region |
| Bulk marketing | Resend broadcasts API (not in Task 7.2); separate from transactional path |

## Database queries (ops)

### Recent failed sends

```sql
SELECT id, "connectionId", "idempotencyKey", "safeErrorCode", "createdAt"
FROM "ProviderOutboundSend"
WHERE "providerKey" = 'resend' AND status = 'FAILED'
ORDER BY "createdAt" DESC
LIMIT 50;
```

### Stuck webhook events

```sql
SELECT id, "eventType", status, "receivedAt", "processedAt"
FROM "ProviderWebhookEvent"
WHERE "providerKey" = 'resend' AND status = 'VERIFIED'
  AND "receivedAt" < NOW() - INTERVAL '5 minutes'
ORDER BY "receivedAt" DESC;
```

### Connections needing reauth

```sql
SELECT id, "organisationId", status, "lastErrorCode", "updatedAt"
FROM "ProviderConnection"
WHERE "providerKey" = 'resend' AND status IN ('REAUTH_REQUIRED', 'ERROR');
```

## Escalation

| Level | Contact | When |
|-------|---------|------|
| L1 | On-call engineer | Send failures, webhook issues |
| L2 | Platform team | Credential compromise, multi-tenant impact |
| L3 | Resend support | Provider outage, rate limit increase, deliverability |

Resend support: [resend.com/contact](https://resend.com/contact)

## Related documentation

- [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md)
- [RESEND_SECURITY_REVIEW.md](./RESEND_SECURITY_REVIEW.md)
- [RESEND_LIMITATIONS.md](./RESEND_LIMITATIONS.md)
- [RESEND_WEBHOOK_MAPPING.md](./RESEND_WEBHOOK_MAPPING.md)
- [../V1_SUPPORT_RUNBOOK.md](../V1_SUPPORT_RUNBOOK.md)
