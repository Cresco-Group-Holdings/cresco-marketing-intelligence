# Resend Provider — Capability Audit (Task 7.2 Phase 1)

> Last reviewed: **2026-08-01** against official Resend documentation.
>
> Official references:
> - [API Introduction](https://resend.com/docs/api-reference/introduction)
> - [Send Email](https://resend.com/docs/api-reference/emails/send-email)
> - [Send Batch Emails](https://resend.com/docs/api-reference/emails/send-batch-emails)
> - [API Keys](https://resend.com/docs/dashboard/api-keys/introduction)
> - [Domains](https://resend.com/docs/dashboard/domains/introduction)
> - [Webhooks](https://resend.com/docs/webhooks/introduction)
> - [Event Types](https://resend.com/docs/webhooks/event-types)
> - [Rate Limits](https://resend.com/docs/api-reference/rate-limit)
> - [Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)

## Executive summary

Resend is a modern transactional and marketing email API with REST endpoints, Svix-signed webhooks, and DNS-based domain verification. Cresco integrates Resend as the first live email provider adapter (Task 7.2) using API key authentication, outbound send, domain status polling, and webhook-driven delivery events.

| Dimension | Resend capability | Cresco Task 7.2 scope |
|-----------|-------------------|----------------------|
| Auth | Bearer API key (`re_*`) | Implemented |
| Send | `POST /emails` | Implemented |
| Batch send | `POST /emails/batch` (max 100) | Partial — sequential single sends, not native batch endpoint |
| Domains | `GET /domains` | Implemented (read-only) |
| Webhooks | Svix headers + JSON events | Implemented |
| Templates | Dashboard + API templates | Not implemented |
| Attachments | Up to 40 MB per email | Not implemented |
| Scheduling | `scheduled_at` parameter | Not implemented |
| Inbound email | `email.received` webhook | Not implemented |
| Contacts / broadcasts | Marketing audience APIs | Not implemented |
| SMTP relay | Supported by Resend | Not implemented in adapter |

## API surface

| Property | Value |
|----------|-------|
| Base URL | `https://api.resend.com` |
| Protocol | HTTPS only (HTTP rejected) |
| API version | No versioning header today (calendar-based versioning planned) |
| Auth | `Authorization: Bearer re_xxxxxxxxx` |
| Content-Type | `application/json` |
| User-Agent | **Required** — requests without `User-Agent` return `403` (error code `1010`) |

Cresco sets `User-Agent: cresco-marketing-intelligence/1.0` on all outbound requests (`resend-client.ts`).

## Authentication & API keys

| Item | Resend behavior | Cresco handling |
|------|-----------------|-----------------|
| Key format | `re_` prefix, alphanumeric + underscore | Validated via `RESEND_API_KEY_PATTERN` |
| Key visibility | Shown once at creation; cannot be retrieved later | Encrypted at rest; fingerprint only in UI |
| Permissions | `full_access` or `sending_access` | Connection validates with `GET /domains` (requires `full_access` or domain list permission) |
| Domain restriction | `sending_access` keys can be scoped to one domain | Recommended for production tenants |
| Key rotation | Create new key, update connection, revoke old key | Manual via disconnect + reconnect |
| Inactive keys | Delete keys unused 30+ days (Resend recommendation) | N/A — tenant-managed |

### Permission comparison

| Permission | Can send email | Can list domains | Can manage webhooks/domains |
|------------|---------------|------------------|----------------------------|
| `sending_access` | Yes (optionally domain-scoped) | No | No |
| `full_access` | Yes | Yes | Yes |

**Recommendation:** Use `sending_access` keys scoped to the tenant's sending domain for production. Use `full_access` only when domain management via API is required. Cresco's connection test calls `GET /domains`, so keys used at connect time must have domain-list permission (typically `full_access`).

## Email send capabilities

### Single send (`POST /emails`)

| Field | Resend support | Cresco adapter |
|-------|----------------|----------------|
| `from` | Required; supports `Name <email@domain>` | Required |
| `to` | Array, max **50** recipients | Enforced (`EMAIL_SEND_MAX_RECIPIENTS = 50`) |
| `cc` / `bcc` | Array, max 50 each | Passed through |
| `subject` | Required | Required |
| `html` / `text` | At least one required | At least one required |
| `reply_to` | String or array | Mapped from `replyTo` |
| `headers` | Custom headers object | Passed through |
| `tags` | Key/value pairs (256 char limit per name/value) | Mapped from `tags` record |
| `attachments` | Max 40 MB after Base64 | Not implemented |
| `scheduled_at` | Natural language or ISO 8601 | Not implemented |
| `template` | Published template ID + variables | Not implemented |
| `topic_id` | Contact topic opt-in/out | Not implemented |

### Batch send (`POST /emails/batch`)

| Property | Resend limit | Cresco limit |
|----------|--------------|--------------|
| Emails per request | **100** | `EMAIL_BATCH_MAX_SIZE = 100` |
| Recipients per email | **50** | `EMAIL_SEND_MAX_RECIPIENTS = 50` |
| Attachments in batch | Not supported by Resend | N/A |
| Idempotency | Single key per batch request | Per-message keys (adapter uses sequential `sendEmail`) |

**Gap:** Resend's native `POST /emails/batch` endpoint is available in the client (`resend-client.ts`) but the adapter's `sendBatch` issues individual `POST /emails` calls. This consumes more rate-limit budget but provides per-message idempotency and error isolation.

### Idempotency

| Property | Resend | Cresco |
|----------|--------|--------|
| Header | `Idempotency-Key` | Sent on every outbound request |
| Max length | 256 characters | Required on `EmailSendRequest` |
| TTL | 24 hours | Mirrored in `ProviderOutboundSend` unique constraint |
| Conflict responses | `409 invalid_idempotent_request`, `409 concurrent_idempotent_requests` | Mapped to `CONFLICT` safe error code |
| SMTP alternative | `Resend-Idempotency-Key` header | Not used |

## Domain verification

Resend requires a verified sending domain (not shared/public domains) for production sends.

### Domain statuses (Resend)

| Status | Meaning |
|--------|---------|
| `not_started` | Domain added; DNS verification not initiated |
| `pending` | Verification in progress |
| `verified` | Ready to send |
| `partially_verified` | One capability (send/receive) verified |
| `partially_failed` | Verified but one feature failed |
| `failed` | DNS records not detected within 72 hours |
| `temporary_failure` | Previously verified; DNS record missing on recheck |

### DNS records

| Record | Purpose | Cresco |
|--------|---------|--------|
| SPF (TXT) | Authorize sending IPs | Status surfaced via `spfStatus` |
| DKIM (TXT/CNAME) | Cryptographic signing (1024-bit; Resend does not support 2048-bit) | Status surfaced via `dkimStatus` |
| DMARC (TXT at `_dmarc`) | Spoofing protection; not auto-provisioned by Resend | Documented in setup guide; tenant-managed |
| MX | Bounce/complaint feedback routing | Part of Resend domain setup |

Cresco maps `status === "verified"` to `sendingEligible: true`. Sends from unverified domains are rejected unless using the Resend sandbox domain `resend.dev` or `messageType === "TEST"`.

### Sandbox sending

| Sender | Recipient | Use |
|--------|-----------|-----|
| `onboarding@resend.dev` | `delivered@resend.dev` | Resend test addresses |
| Any `@resend.dev` | — | Allowed without tenant domain verification |

## Webhook capabilities

Resend delivers webhooks via [Svix](https://docs.svix.com/). All webhook requests include:

| Header | Purpose |
|--------|---------|
| `svix-id` | Unique delivery ID (use for deduplication) |
| `svix-timestamp` | Unix seconds (replay protection) |
| `svix-signature` | `v1,<base64-hmac>` (may contain multiple space-separated signatures) |

Signing secret format: `whsec_<base64>` (decoded before HMAC verification).

### Delivery semantics

| Property | Resend behavior | Cresco handling |
|----------|-----------------|-----------------|
| Delivery guarantee | At-least-once | Idempotent on `svix-id` / `externalEventId` |
| Ordering | Not guaranteed | Status precedence rules in normalizer |
| Retry schedule | 5s → 5m → 30m → 2h → 5h → 10h | Return `200` quickly; process async |
| Replay | Manual replay from dashboard | Re-processes if new `svix-id` |
| Source IPs | Fixed allowlist (4 IPv4 + 1 IPv6 range) | Document in firewall rules if needed |

### Event categories

| Category | Events | Cresco support |
|----------|--------|----------------|
| Email lifecycle | `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed`, `email.opened`, `email.clicked`, `email.suppressed` | Implemented |
| Email (not wired) | `email.received`, `email.scheduled` | Not implemented |
| Domain | `domain.created`, `domain.updated`, `domain.deleted` | Mapped to internal domain events |
| Suppression | `suppression.added`, `suppression.removed` | `added` mapped; `removed` → `UNKNOWN` |
| Contact | `contact.created`, `contact.updated`, `contact.deleted` | Not implemented |

## Rate limits & quotas

### API rate limit

| Limit | Default | Notes |
|-------|---------|-------|
| Requests per second | **10 req/s per team** | Shared across all API keys |
| HTTP response | `429` with `retry-after` header | Mapped to `RATE_LIMITED` |
| Response headers | `ratelimit-limit`, `ratelimit-remaining`, `ratelimit-reset` | Logged in observability layer |
| Increase | Available on request to Resend support | Enterprise consideration |

### Email quotas

| Quota | Applies to | Response |
|-------|-----------|----------|
| Daily | Free plan | `429 daily_quota_exceeded` |
| Monthly | Plan-dependent | `429 monthly_quota_exceeded` |
| Headers | `x-resend-daily-quota`, `x-resend-monthly-quota` | Monitor in ops |

### Contact quotas (marketing)

Broadcast sends blocked at `403` when contact quota exceeded. Not applicable to transactional sends in Task 7.2.

## Platform adapter capabilities

Registered in `PROVIDER_DEFINITIONS` with `authType: API_KEY`:

```
EMAIL_SEND, EMAIL_BATCH_SEND, EMAIL_DELIVERY_EVENTS, EMAIL_DOMAIN_STATUS,
WEBHOOK_RECEIVE, CONNECTION_TEST, HEALTH_CHECK
```

### Implemented adapter methods

| Method | Description |
|--------|-------------|
| `validateApiKey` | Format check + `GET /domains` |
| `testConnection` | Domain count + verified count |
| `getHealth` | Derived from test connection |
| `listVerifiedDomains` | `GET /domains` → `VerifiedDomainInfo[]` |
| `sendEmail` | `POST /emails` with idempotency + domain gate |
| `sendBatch` | Sequential `sendEmail` per message |
| `revokeConnection` | Local credential revocation only |
| `verifyWebhookSignature` | Svix-compatible HMAC-SHA256 |
| `normalizeWebhookEvent` | Resend → internal event types |

## Commercial & compliance considerations

| Topic | Detail |
|-------|--------|
| Pricing | Plan-based; daily quota on free tier |
| EU data residency | Region selection available for domains |
| Dedicated IPs | Not offered by Resend |
| Open/click tracking | Disabled by default; tenant configures in Resend dashboard |
| Suppression lists | Account-level; synced via webhooks to Cresco `EmailSuppression` |
| Terms | Resend Terms of Service; tenant is data controller for recipient PII |

## Gaps & deferred capabilities

The following Resend features are available but **out of scope** for Task 7.2:

- Template-based sends (`template` object)
- Attachments and inline images
- Scheduled sends (`scheduled_at`)
- Inbound email (`email.received`)
- Contact/segment/broadcast management
- Webhook registration via API (manual dashboard setup)
- Domain create/update via API (DNS configured in Resend dashboard)
- Native batch endpoint usage
- SMTP relay

See [RESEND_LIMITATIONS.md](./RESEND_LIMITATIONS.md) for implementation-specific constraints.

## Phase 1 audit checklist

| # | Audit item | Status | Notes |
|---|-----------|--------|-------|
| 1 | API base URL and auth model documented | ✅ | Bearer `re_*` |
| 2 | API key permission types understood | ✅ | `full_access` vs `sending_access` |
| 3 | Send limits validated (50 recipients, 100 batch) | ✅ | Enforced in adapter |
| 4 | Idempotency semantics documented | ✅ | 24h TTL, `Idempotency-Key` header |
| 5 | Rate limit (10 req/s) and 429 handling | ✅ | Retry-after support in client |
| 6 | Domain verification flow documented | ✅ | SPF/DKIM/DMARC |
| 7 | Webhook signature scheme (Svix) | ✅ | Manual HMAC implementation |
| 8 | All email event types catalogued | ✅ | 10 wired, 2 deferred |
| 9 | Sandbox/test addresses identified | ✅ | `resend.dev` domain |
| 10 | Security: no plaintext secrets at rest | ✅ | AES-256-GCM encryption |
| 11 | Security: webhook replay protection | ✅ | 5-minute timestamp tolerance |
| 12 | Security: tenant isolation | ✅ | `organisationId` scoping |
| 13 | Emergency shutdown mechanism | ✅ | `EMAIL_EMERGENCY_SHUTDOWN` flag |
| 14 | Live call gating | ✅ | `PROVIDER_LIVE_CALLS_ENABLED` |
| 15 | Provider feature flag | ✅ | `RESEND_PROVIDER_ENABLED` |
| 16 | Audit trail for sends and webhooks | ✅ | `ProviderAuditEvent` |
| 17 | Suppression sync from bounces/complaints | ✅ | Hard bounce + complaint handlers |
| 18 | Error code normalization | ✅ | Safe error codes only to clients |

## Related documentation

- [RESEND_SETUP_GUIDE.md](./RESEND_SETUP_GUIDE.md)
- [RESEND_SECURITY_REVIEW.md](./RESEND_SECURITY_REVIEW.md)
- [RESEND_WEBHOOK_MAPPING.md](./RESEND_WEBHOOK_MAPPING.md)
- [RESEND_OPERATIONS_RUNBOOK.md](./RESEND_OPERATIONS_RUNBOOK.md)
- [RESEND_LIMITATIONS.md](./RESEND_LIMITATIONS.md)
- [../PROVIDER_INTEGRATION_ARCHITECTURE.md](../PROVIDER_INTEGRATION_ARCHITECTURE.md)
- [../EMAIL_PROVIDER_CAPABILITIES.md](../EMAIL_PROVIDER_CAPABILITIES.md)
