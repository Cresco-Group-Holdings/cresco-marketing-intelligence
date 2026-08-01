# Resend Provider — Security Review (Task 7.2)

> Last reviewed: **2026-08-01**.
>
> Security controls implemented for the Resend provider integration, mapped to the Task 7.1 provider security foundation.

## Scope

This review covers:

- API key storage and handling
- Outbound send authorization gates
- Webhook signature verification and replay protection
- Tenant isolation
- Audit and redaction
- Feature flags and emergency controls

Out of scope: Resend platform security (SOC 2, infrastructure) — refer to [Resend security documentation](https://resend.com/security).

## Threat model

| Threat | Impact | Mitigation | Status |
|--------|--------|------------|--------|
| API key leak via HTTP response | Credential exposure | Fingerprints only; never return plaintext | ✅ Implemented |
| API key leak via logs/audit | Credential exposure | `redactSecrets()` on all metadata | ✅ Implemented |
| API key leak via error messages | Credential exposure | `sanitizeErrorMessage()` strips `re_*` patterns | ✅ Implemented |
| Cross-tenant credential access | Data breach | `organisationId` on every query | ✅ Implemented |
| Cross-tenant webhook processing | Wrong tenant events | Signature-based endpoint resolution per connection | ✅ Implemented |
| Webhook forgery | Fake bounce/suppression events | Svix HMAC-SHA256 verification | ✅ Implemented |
| Webhook replay | Duplicate/malicious re-delivery | `svix-timestamp` 5-minute tolerance + `svix-id` idempotency | ✅ Implemented |
| Unauthorized send | Spam/phishing from platform | RBAC + approval gates + domain verification | ✅ Implemented |
| Runaway send volume | Cost/reputation damage | Rate limit handling + circuit breaker + emergency shutdown | ✅ Implemented |
| Send to suppressed recipients | Compliance violation | Pre-send suppression check | ✅ Implemented |
| Unverified domain spoofing | Deliverability/reputation | Domain eligibility gate before send | ✅ Implemented |
| Live calls in non-prod | Accidental production sends | `PROVIDER_LIVE_CALLS_ENABLED` gate | ✅ Implemented |
| Missing User-Agent 403 | Silent send failures | `User-Agent` header on all requests | ✅ Implemented |

## Credential security

### At-rest encryption

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key source | `ENCRYPTION_KEY` (min 32 chars) |
| Storage | `ProviderCredential.encryptedValue` |
| Types | `API_KEY`, `WEBHOOK_SIGNING_SECRET` |
| Implementation | `src/lib/security/encryption.ts` |

API keys are encrypted via `providerCredentialService.storeCredential()` immediately on connect. Plaintext exists only in server memory during the store/retrieve lifecycle.

### API key validation

```typescript
RESEND_API_KEY_PATTERN = /^re_[A-Za-z0-9_]+$/
```

Malformed keys are rejected before any network call (`provider-resend-connection-service.ts`).

### Display policy

Only credential fingerprints are exposed to clients:

```
re_secret_key_value → ****alue
```

Short values (≤4 chars) display as `****`.

### Retrieval policy

`getCredentialPlaintext()` is server-only, called exclusively from:

- `adapter-registry.ts` (adapter credential injection)
- `provider-webhook-service.ts` (webhook secret lookup)
- `unified-email-provider-service.ts` (send path)

Never imported in API route handlers or client components.

### Recommended key permissions

| Environment | Permission | Domain scope |
|-------------|-----------|--------------|
| Production | `sending_access` | Tenant sending domain |
| Staging/Preview | `sending_access` | Staging subdomain |
| Setup/validation | `full_access` (temporary) | Rotate to `sending_access` after setup |

## Outbound send authorization

Sends pass through layered gates in `unified-email-provider-service.ts`:

```
1. PROVIDER_CONNECTORS_ENABLED
2. EMAIL_EMERGENCY_SHUTDOWN
3. PROVIDER_LIVE_CALLS_ENABLED (skipped for testMode)
4. Connection status === CONNECTED
5. Per-connection live_sending feature flag
6. RBAC permission (email.sendTransactional | sendMarketing | sendTest)
7. approvalId required (non-test, non-simulated)
8. Circuit breaker not OPEN
9. Recipient suppression check
10. Domain sending eligibility (adapter)
```

### Domain verification gate

Before `POST /emails`, the adapter checks that the `from` address domain is in the verified domain list with `sendingEligible: true`. Exceptions:

- `resend.dev` sandbox domain
- `messageType === "TEST"`

Unverified domains return `DOMAIN_NOT_VERIFIED` without contacting Resend.

### Idempotency protection

| Layer | Mechanism |
|-------|-----------|
| Application | `ProviderOutboundSend` unique on `(organisationId, connectionId, idempotencyKey)` |
| Provider | `Idempotency-Key` header (24h TTL) |

Duplicate requests return `status: DUPLICATE` with the original `providerMessageId`.

## Webhook security

### Signature verification

Implementation: `src/server/providers/resend/resend-webhook.ts`

| Step | Detail |
|------|--------|
| 1 | Extract `svix-id`, `svix-timestamp`, `svix-signature` headers |
| 2 | Validate timestamp within `PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS` (5 minutes) |
| 3 | Decode `whsec_` prefix from signing secret |
| 4 | Compute `HMAC-SHA256(secret, "${svix-id}.${svix-timestamp}.${rawBody}")` |
| 5 | Compare against `v1,<signature>` entries using `timingSafeEqual` |

Uses raw request body — JSON re-serialization breaks verification.

### Tenant resolution

Resend webhooks do not include `account_id`. Cresco resolves the tenant by:

1. Loading all active `ProviderWebhookEndpoint` records for `providerKey: resend`.
2. Attempting signature verification with each connection's `WEBHOOK_SIGNING_SECRET`.
3. First match wins → `organisationId` + `connectionId`.

This prevents trusting client-supplied tenant identifiers.

### Idempotency

| Field | Source | Constraint |
|-------|--------|------------|
| `externalEventId` | `svix-id` header | `@@unique([providerKey, externalEventId])` |

Duplicate `svix-id` values return `200` without reprocessing.

### Payload storage

Raw webhook bodies are **never stored**. Only SHA-256 digest (`payloadDigest`) is persisted.

### Rejected webhook audit

Failed verifications record `WEBHOOK_REJECTED` audit events with error codes:

- `MISSING_EVENT_ID`
- `TIMESTAMP_OUT_OF_TOLERANCE`
- `INVALID_JSON`
- `CONNECTION_NOT_RESOLVED`
- `SIGNATURE_INVALID`

## Error handling security

### Safe error codes

Provider errors are normalized to a fixed allowlist before reaching clients:

```
VALIDATION_ERROR, AUTHENTICATION_REQUIRED, INVALID_CREDENTIALS, FORBIDDEN,
NOT_FOUND, CONFLICT, RATE_LIMITED, PROVIDER_UNAVAILABLE, NETWORK_ERROR,
MALFORMED_RESPONSE, DOMAIN_NOT_VERIFIED, RECIPIENT_LIMIT_EXCEEDED, UNKNOWN
```

Raw Resend error messages may contain internal details — only `safeErrorCode` is returned to API consumers.

### HTTP status mapping

| Resend status | Safe code | Retryable |
|---------------|-----------|-----------|
| 400, 422 | `VALIDATION_ERROR` | No |
| 401 | `AUTHENTICATION_REQUIRED` | No |
| 403 | `INVALID_CREDENTIALS` | No |
| 404 | `NOT_FOUND` | No |
| 409 | `CONFLICT` | No |
| 429 | `RATE_LIMITED` | Yes |
| 5xx | `PROVIDER_UNAVAILABLE` | Yes |

## Tenant isolation

Every Resend-related database query includes `organisationId`:

```typescript
where: { id: connectionId, organisationId: context.organisationId, providerKey: "resend" }
```

Webhook events, outbound sends, suppressions, and audit records are all scoped to the resolved organisation.

## RBAC permissions

| Permission | Operation |
|------------|-----------|
| `providerConnections.create` | Create Resend connection |
| `providerConnections.read` | List connections, domains |
| `providerConnections.test` | Test connection |
| `providerConnections.revoke` | Disconnect |
| `providerConnections.viewAudit` | View audit trail |
| `email.sendTransactional` | Send transactional email |
| `email.sendMarketing` | Send marketing email |
| `email.sendTest` | Send test email |

## Feature flags

| Flag | Default | Security purpose |
|------|---------|-----------------|
| `RESEND_PROVIDER_ENABLED` | unset (disabled) | Prevent Resend operations until explicitly enabled |
| `PROVIDER_CONNECTORS_ENABLED` | enabled | Global connector kill switch |
| `PROVIDER_LIVE_CALLS_ENABLED` | disabled | Prevent accidental live API calls |
| `EMAIL_EMERGENCY_SHUTDOWN` | disabled | Immediate send halt |

## Audit trail

| Action | Trigger |
|--------|---------|
| `CONNECTION_TESTED` | Connect or manual test |
| `CREDENTIAL_REVOKED` | Disconnect |
| `EMAIL_SEND_ATTEMPTED` | Send initiated |
| `EMAIL_SEND_ACCEPTED` | Resend accepted message |
| `EMAIL_SEND_REJECTED` | Send failed validation/provider |
| `EMAIL_SEND_SIMULATED` | Dry-run send |
| `WEBHOOK_RECEIVED` | Verified webhook ingested |
| `WEBHOOK_REJECTED` | Failed verification |
| `SUPPRESSION_APPLIED` | Bounce/complaint suppression |
| `RATE_LIMIT_REACHED` | 429 from Resend |

All metadata passes through `redactSecrets()`.

## Suppression security

Hard bounces (`bounce.type === "Permanent"`) and spam complaints automatically add recipients to `EmailSuppression`:

- Scoped per `organisationId`
- Source: `PROVIDER_WEBHOOK`
- Pre-send check blocks future sends to suppressed addresses

## Network security

| Control | Detail |
|---------|--------|
| HTTPS only | All requests to `https://api.resend.com` |
| Request timeout | 30 seconds (`PROVIDER_REQUEST_TIMEOUT_MS`) |
| Correlation ID | `X-Correlation-Id` header on outbound requests |
| No credential in URL | Bearer token in `Authorization` header only |

## Compliance notes

| Topic | Handling |
|-------|----------|
| PII in webhooks | Recipient email in event payload; not stored in raw form (digest only) |
| Right to erasure | Suppression records deletable per organisation; audit retention per platform policy |
| Data residency | Resend domain region selection (tenant configures in Resend) |
| CAN-SPAM / GDPR | Marketing sends require approval gate; suppression enforced |

## Security testing

Unit tests cover:

- API key format validation
- Credential encryption round-trip
- Secret redaction in audit metadata
- Webhook signature verification (valid + invalid)
- Stale timestamp rejection
- Safe error code mapping
- Event status precedence (no downgrade attacks)

See `tests/unit/resend-provider.test.ts` and `tests/integration/resend-provider.test.ts`.

## Residual risks

| Risk | Severity | Mitigation path |
|------|----------|-----------------|
| `full_access` key used in production | Medium | Document `sending_access` requirement; validate permission at connect |
| Webhook secret not configured | Medium | Connection health warning; setup guide enforcement |
| Out-of-order webhook events | Low | Status precedence rules; use `created_at` for ordering |
| Rate limit at 10 req/s | Low | Queue/retry; request increase from Resend |
| No provider-side key revocation on disconnect | Low | Manual key deletion documented in setup guide |
| Batch sends use N API calls | Low | Migrate to native batch endpoint |

## Related documentation

- [../PROVIDER_SECURITY_MODEL.md](../PROVIDER_SECURITY_MODEL.md)
- [../PROVIDER_CREDENTIAL_LIFECYCLE.md](../PROVIDER_CREDENTIAL_LIFECYCLE.md)
- [../PROVIDER_WEBHOOK_STANDARD.md](../PROVIDER_WEBHOOK_STANDARD.md)
- [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md)
- [RESEND_WEBHOOK_MAPPING.md](./RESEND_WEBHOOK_MAPPING.md)
