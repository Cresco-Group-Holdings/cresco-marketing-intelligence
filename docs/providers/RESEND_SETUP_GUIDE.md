# Resend Provider — Setup Guide (Task 7.2)

> Last reviewed: **2026-08-01** against official Resend documentation.
>
> This guide covers end-to-end setup: Resend account configuration, Cresco connection, domain verification, webhooks, test sends, disconnect, and emergency shutdown.

## Prerequisites

| Requirement | Detail |
|-------------|--------|
| Cresco Task 7.1 foundation | Provider models, credential encryption, webhook ingestion |
| Environment variables | See [Environment configuration](#environment-configuration) |
| Permissions | `providerConnections.create`, `providerConnections.write`, `email.sendTest` |
| Resend account | [resend.com](https://resend.com) team with API access |

## Environment configuration

Set these server-only variables before enabling Resend:

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `ENCRYPTION_KEY` | Yes | 32+ char secret | Credential encryption |
| `RESEND_PROVIDER_ENABLED` | Yes | `"true"` | Enable Resend connector |
| `PROVIDER_CONNECTORS_ENABLED` | Yes | `"true"` (default) | Global connector gate |
| `PROVIDER_LIVE_CALLS_ENABLED` | For live sends | `"true"` | Allow outbound API calls |
| `WEBHOOK_BASE_URL` | For webhooks | `https://app.example.com/api/webhooks/providers` | Public webhook base |
| `EMAIL_EMERGENCY_SHUTDOWN` | No | `"false"` (default) | Kill switch for all email sends |
| `APP_URL` | Yes | `https://app.example.com` | Application canonical URL |

### Environment matrix

| Environment | `RESEND_PROVIDER_ENABLED` | `PROVIDER_LIVE_CALLS_ENABLED` | Notes |
|-------------|--------------------------|-------------------------------|-------|
| Local dev | `"true"` | `"false"` | Simulated sends only |
| Preview | `"true"` | `"false"` | Test connection OK; no live sends |
| Production | `"true"` | `"true"` | After onboarding checklist complete |

Never share `ENCRYPTION_KEY` or Resend API keys across environments.

---

## Step 1: Create a restricted API key

1. Sign in to the [Resend Dashboard](https://resend.com/api-keys).
2. Click **Create API Key**.
3. Configure:

| Field | Recommended value | Why |
|-------|-------------------|-----|
| Name | `cresco-<org-slug>-production` | Traceable per tenant/environment |
| Permission | `sending_access` | Least privilege for send-only |
| Domain | Your verified sending domain | Restricts key to one domain |

> **Note:** Cresco's connection validation calls `GET /domains`, which requires domain-list permission. For initial connect + domain status checks, you may need `full_access` or connect with `full_access` then rotate to `sending_access` after setup. Prefer `sending_access` scoped to domain for ongoing production sends.

4. Copy the key immediately — Resend shows it **once**. Format: `re_xxxxxxxx`.
5. Store securely; you will paste it into Cresco's connection panel (encrypted on receipt).

### Key hygiene (Resend recommendations)

- Use separate keys per application/environment.
- Delete keys unused for 30+ days.
- Never commit keys to source control.
- Rotate on suspected compromise.

---

## Step 2: Add and verify a sending domain

### 2.1 Add domain in Resend

1. Go to [Resend Domains](https://resend.com/domains).
2. Click **Add Domain**.
3. Enter a **subdomain** (recommended), e.g. `mail.example.com` or `updates.example.com`.
4. Select region if EU data residency is required.
5. Resend generates DNS records (SPF, DKIM, and optionally MX for receiving).

### 2.2 Configure DNS records

Add the records shown in the Resend dashboard **Records** tab to your DNS provider:

| Record type | Purpose | Typical name |
|-------------|---------|--------------|
| TXT (SPF) | Authorize Resend sending IPs | `@` or subdomain |
| CNAME/TXT (DKIM) | Email authentication signature | `resend._domainkey` or similar |
| MX (optional) | Inbound/receiving + bounce routing | Subdomain |

Click **Verify DNS Records** in Resend after propagation (may take up to 72 hours; usually minutes).

### 2.3 Domain status reference

| Status | Action |
|--------|--------|
| `pending` | Wait for DNS propagation; recheck |
| `verified` | Ready for production sends |
| `failed` | Re-check DNS values; see [Resend troubleshooting](https://resend.com/docs/knowledge-base/what-if-my-domain-is-not-verifying) |
| `temporary_failure` | DNS record removed; restore within 72h |

### 2.4 SPF

Resend provisions an SPF TXT record listing authorized senders. Do not duplicate SPF records — merge into a single TXT record per RFC 7208 if combining with other senders.

### 2.5 DKIM

Resend signs with **1024-bit** DKIM keys (not 2048-bit). This satisfies major mailbox provider requirements.

### 2.6 DMARC (strongly recommended)

DMARC is **not** auto-provisioned. Add a TXT record at `_dmarc.yourdomain.com`:

**Phase 1 — monitoring (start here):**

```
v=DMARC1; p=none; rua=mailto:dmarcreports@yourdomain.com;
```

**Phase 2 — after 1–2 weeks of `dmarc=pass`:**

```
v=DMARC1; p=quarantine; rua=mailto:dmarcreports@yourdomain.com;
```

**Phase 3 — production hardening:**

```
v=DMARC1; p=reject; rua=mailto:dmarcreports@yourdomain.com;
```

Prerequisites: SPF and DKIM must pass before tightening DMARC policy. See [Resend DMARC guide](https://resend.com/docs/dashboard/domains/dmarc).

### 2.7 Verify in Cresco

After connecting (Step 3), refresh domain status:

```http
GET /api/providers/connections/{connectionId}/domains
```

Confirmed domains appear with `sendingEligible: true`.

---

## Step 3: Connect Resend in Cresco

### Via UI

1. Navigate to **Integrations** → **Resend**.
2. Enter:
   - **Display name** — e.g. `Resend Production`
   - **API key** — `re_...` (cleared from form after submit)
   - **Default sending domain** — e.g. `mail.example.com` (optional)
3. Click **Connect**.

On success, the UI shows a credential fingerprint (last 4 chars only).

### Via API

```http
POST /api/providers/resend/connect
Content-Type: application/json
x-organisation-id: <org-id>

{
  "displayName": "Resend Production",
  "apiKey": "re_xxxxxxxxx",
  "defaultSendingDomain": "mail.example.com",
  "environment": "PRODUCTION"
}
```

### What happens on connect

1. API key format validated (`re_[A-Za-z0-9_]+`).
2. Key verified against Resend (`GET /domains`).
3. Key encrypted and stored in `ProviderCredential` (type `API_KEY`).
4. Connection status set to `CONNECTED`.
5. Health record created (`HEALTHY` on success).
6. Audit event: `CONNECTION_TESTED`.

---

## Step 4: Configure webhooks

### 4.1 Webhook endpoint URL

Cresco receives Resend webhooks at:

```
{WEBHOOK_BASE_URL}/resend
```

Example: `https://app.example.com/api/webhooks/providers/resend`

### 4.2 Create webhook in Resend

1. Go to [Resend Webhooks](https://resend.com/webhooks).
2. Click **Add Webhook**.
3. Enter the Cresco URL above.
4. Select events (minimum recommended set):

| Event | Purpose |
|-------|---------|
| `email.sent` | Confirm acceptance |
| `email.delivered` | Delivery confirmation |
| `email.bounced` | Hard/soft bounce handling |
| `email.complained` | Spam complaint → suppression |
| `email.failed` | Send failure |
| `email.delivery_delayed` | Temporary delivery issues |
| `email.suppressed` | Provider-side suppression |
| `domain.updated` | Domain verification changes |
| `suppression.added` | Suppression list sync |

5. Copy the **signing secret** (`whsec_...`).
6. Store the signing secret in Cresco as `WEBHOOK_SIGNING_SECRET` on the connection's `ProviderWebhookEndpoint`.

### 4.3 Webhook verification

Resend uses Svix-compatible signatures. Cresco verifies:

- `svix-id` — event deduplication key
- `svix-timestamp` — must be within 5 minutes
- `svix-signature` — HMAC-SHA256 with decoded `whsec_` secret

### 4.4 Firewall allowlist (optional)

If your infrastructure restricts inbound IPs, allow Resend webhook sources:

- `44.228.126.217`
- `50.112.21.217`
- `52.24.126.164`
- `54.148.139.208`
- `2600:1f24:64:8000::/52`

### 4.5 Local development

Use [ngrok](https://ngrok.com/) or the [Resend CLI `webhooks listen`](https://resend.com/docs/cli) command to tunnel webhooks to localhost.

---

## Step 5: Enable live sending

Live sends require **all** of the following:

| Gate | How to enable |
|------|---------------|
| `RESEND_PROVIDER_ENABLED=true` | Environment variable |
| `PROVIDER_LIVE_CALLS_ENABLED=true` | Environment variable |
| Connection status `CONNECTED` | Successful connect |
| Per-connection `live_sending` flag | `ProviderFeatureFlag` (if configured) |
| Domain verified | `sendingEligible` for `from` address |
| Approval | `approvalId` required for non-test sends |
| Permission | `email.sendTransactional` / `email.sendMarketing` / `email.sendTest` |
| Circuit breaker | Not `OPEN` on connection health |

---

## Step 6: Test send

### 6.1 Connection test (no email sent)

```http
POST /api/providers/connections/{connectionId}/test
x-organisation-id: <org-id>
```

Returns domain count, verified domain count, and health status.

### 6.2 Sandbox test send

With `PROVIDER_LIVE_CALLS_ENABLED=true`, send to Resend test addresses:

| Field | Value |
|-------|-------|
| From | `onboarding@resend.dev` |
| To | `delivered@resend.dev` |
| Subject | `Cresco test` |
| Body | `Test message` |
| `messageType` | `TEST` |

```http
POST /api/providers/email/send
Content-Type: application/json
x-organisation-id: <org-id>

{
  "connectionId": "<connection-id>",
  "messageType": "TEST",
  "from": "onboarding@resend.dev",
  "to": ["delivered@resend.dev"],
  "subject": "Cresco Resend test",
  "html": "<p>Test successful</p>",
  "idempotencyKey": "test-<uuid>"
}
```

### 6.3 Production domain test

Use your verified domain:

```json
{
  "from": "Cresco <noreply@mail.example.com>",
  "to": ["your-inbox@example.com"],
  "messageType": "TEST"
}
```

### 6.4 Verify webhook delivery

1. Send a test email.
2. Check Resend webhook dashboard for delivery status.
3. Confirm Cresco `ProviderWebhookEvent` records with status `VERIFIED` → `PROCESSED`.
4. Check `EmailDeliveryEvent` rows for the message.

### 6.5 Simulated send (no live call)

With `PROVIDER_LIVE_CALLS_ENABLED=false` (or `testMode: true`), sends return `status: SIMULATED` without contacting Resend. Use this in Preview/staging.

---

## Step 7: Disconnect

### Via API

```http
POST /api/providers/connections/{connectionId}/revoke
x-organisation-id: <org-id>
```

### What happens on disconnect

1. All credentials for the connection are soft-revoked (`revokedAt` set).
2. Connection status set to disconnected.
3. Audit event: `CREDENTIAL_REVOKED`.
4. Webhook endpoint should be **manually deleted** in Resend dashboard.
5. API key should be **manually deleted** in Resend dashboard.

Cresco does not call Resend's API to delete keys or webhooks on disconnect — revoke on both sides.

---

## Step 8: Emergency shutdown

Immediate stop for all email sends across the platform.

### Activate

```bash
EMAIL_EMERGENCY_SHUTDOWN=true
```

Redeploy or update the runtime environment variable. No application restart logic is required beyond env reload.

### Effect

- All send requests fail with `403 Email emergency shutdown is active.`
- Webhooks continue to be accepted (delivery events for in-flight emails).
- Connection tests still work.

### Deactivate

```bash
EMAIL_EMERGENCY_SHUTDOWN=false
```

### When to use

- Suspected credential compromise
- Runaway send loop
- Provider abuse report
- Regulatory hold on outbound email

### Additional kill switches

| Switch | Scope |
|--------|-------|
| `PROVIDER_CONNECTORS_ENABLED=false` | All provider operations |
| `PROVIDER_LIVE_CALLS_ENABLED=false` | All live API calls (simulated sends only) |
| `RESEND_PROVIDER_ENABLED=false` | Resend connect/send only |
| Per-connection `live_sending` flag | Single tenant connection |
| Delete/revoke API key in Resend | Provider-side hard stop |

**Recommended incident order:** `EMAIL_EMERGENCY_SHUTDOWN=true` → revoke connection → delete Resend API key.

---

## Post-setup checklist

- [ ] API key created with least-privilege permission
- [ ] Sending domain verified (`verified` status in Resend)
- [ ] SPF and DKIM records passing
- [ ] DMARC record added (at least `p=none`)
- [ ] Cresco connection `CONNECTED` with healthy status
- [ ] Webhook registered with signing secret stored encrypted
- [ ] Test send delivered and webhook processed
- [ ] `PROVIDER_LIVE_CALLS_ENABLED=true` only in production
- [ ] Audit events visible for connect, send, and webhook
- [ ] Emergency shutdown procedure documented for on-call

## Related documentation

- [RESEND_CAPABILITY_AUDIT.md](./RESEND_CAPABILITY_AUDIT.md)
- [RESEND_SECURITY_REVIEW.md](./RESEND_SECURITY_REVIEW.md)
- [RESEND_OPERATIONS_RUNBOOK.md](./RESEND_OPERATIONS_RUNBOOK.md)
- [../PROVIDER_ONBOARDING_CHECKLIST.md](../PROVIDER_ONBOARDING_CHECKLIST.md)
