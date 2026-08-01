# Resend Webhook Event Mapping (Task 7.2)

> Last reviewed: **2026-08-01** against [Resend Event Types](https://resend.com/docs/webhooks/event-types).
>
> Maps Resend webhook `type` values to Cresco internal normalized event types, email statuses, and processing behavior.

## Overview

Resend webhooks deliver JSON payloads via Svix with this structure:

```json
{
  "type": "email.delivered",
  "created_at": "2026-08-01T10:00:00.000Z",
  "data": { ... }
}
```

Cresco normalizes these into `NormalizedProviderEmailEvent` (`resend-normalizer.ts`) and processes them via `resendWebhookProcessorService`.

## Webhook headers

| Resend/Svix header | Cresco constant | Purpose |
|--------------------|-----------------|---------|
| `svix-id` | `RESEND_WEBHOOK_HEADERS.id` | Unique delivery ID → `externalEventId` |
| `svix-timestamp` | `RESEND_WEBHOOK_HEADERS.timestamp` | Replay protection (5-min window) |
| `svix-signature` | `RESEND_WEBHOOK_HEADERS.signature` | HMAC verification (`v1,<base64>`) |

**Deduplication key:** Always use `svix-id`, not the payload `type` or `email_id`.

## Event type mapping

### Email events

| Resend `type` | Internal `eventType` | Email `status` | Processed | Notes |
|---------------|---------------------|----------------|-----------|-------|
| `email.sent` | `EMAIL_SENT` | `SENT` | ✅ | API accepted; delivery attempted |
| `email.delivered` | `EMAIL_DELIVERED` | `DELIVERED` | ✅ | Recipient MX accepted |
| `email.delivery_delayed` | `EMAIL_DELAYED` | `DELAYED` | ✅ | Temporary delivery issue |
| `email.bounced` | `EMAIL_BOUNCED` | `BOUNCED` | ✅ | Permanent or temporary bounce |
| `email.complained` | `EMAIL_COMPLAINED` | `COMPLAINED` | ✅ | Recipient marked as spam |
| `email.failed` | `EMAIL_FAILED` | `FAILED` | ✅ | Send-time failure |
| `email.opened` | `EMAIL_OPENED` | `OPENED` | ✅ | Tracking pixel (if enabled) |
| `email.clicked` | `EMAIL_CLICKED` | `CLICKED` | ✅ | Link tracking (if enabled) |
| `email.suppressed` | `EMAIL_SUPPRESSED` | `SUPPRESSED` | ✅ | Resend suppression list |
| `email.received` | `UNKNOWN` | — | ❌ | Inbound email; not implemented |
| `email.scheduled` | `UNKNOWN` | — | ❌ | Scheduled send; not implemented |

### Domain events

| Resend `type` | Internal `eventType` | Email `status` | Processed | Notes |
|---------------|---------------------|----------------|-----------|-------|
| `domain.created` | `DOMAIN_VERIFIED` | — | ⚠️ Partial | Treated as verification signal |
| `domain.updated` | `DOMAIN_VERIFIED` | — | ⚠️ Partial | Status change; refresh domains |
| `domain.deleted` | `DOMAIN_FAILED` | — | ⚠️ Partial | Domain removed from Resend |

Domain events do not update `EmailMessage` status. Refresh domain list via `GET /domains` on `domain.updated`.

### Suppression events

| Resend `type` | Internal `eventType` | Email `status` | Processed | Notes |
|---------------|---------------------|----------------|-----------|-------|
| `suppression.added` | `EMAIL_SUPPRESSED` | `SUPPRESSED` | ✅ | Adds to `EmailSuppression` |
| `suppression.removed` | `UNKNOWN` | — | ❌ | Removal not synced to Cresco |

### Contact events (not implemented)

| Resend `type` | Internal `eventType` | Processed |
|---------------|---------------------|-----------|
| `contact.created` | `UNKNOWN` | ❌ |
| `contact.updated` | `UNKNOWN` | ❌ |
| `contact.deleted` | `UNKNOWN` | ❌ |

## Payload field extraction

### Common `data` fields

| Resend field | Internal field | Extraction logic |
|--------------|----------------|------------------|
| `data.email_id` / `data.emailId` | `providerMessageId` | Primary message correlation key |
| `data.to` (string or array) | `recipient` | First element if array |
| `data.broadcast_id` | `campaignId` | Marketing broadcast reference |
| `data.template_id` | `safeMetadata.templateId` | Template reference |
| `data.bounce.type` | `safeMetadata.bounceType` | `"Permanent"` or `"Temporary"` |
| `created_at` (root) | `occurredAt` | ISO 8601 timestamp |

### Bounce payload example

```json
{
  "type": "email.bounced",
  "created_at": "2026-08-01T10:00:00.000Z",
  "data": {
    "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
    "to": ["user@example.com"],
    "bounce": {
      "type": "Permanent",
      "subType": "Suppressed",
      "message": "Recipient on suppression list"
    }
  }
}
```

Normalized output:

```json
{
  "eventType": "EMAIL_BOUNCED",
  "providerMessageId": "56761188-7520-42d8-8898-ff6fc54ce618",
  "recipient": "user@example.com",
  "safeMetadata": {
    "providerEventType": "email.bounced",
    "bounceType": "Permanent"
  }
}
```

## Status precedence

Webhook events may arrive out of order. Cresco uses precedence ranks to prevent status downgrades (`shouldAdvanceEmailStatus`):

| Status | Rank | Terminal |
|--------|------|----------|
| `DRAFT` | 0 | |
| `APPROVED` | 1 | |
| `QUEUED` | 2 | |
| `SUBMITTING` | 3 | |
| `ACCEPTED` | 4 | |
| `SENT` | 5 | |
| `DELAYED` | 5 | |
| `DELIVERED` | 6 | |
| `OPENED` | 7 | |
| `CLICKED` | 8 | |
| `FAILED` | 10 | ✅ |
| `BOUNCED` | 10 | ✅ |
| `COMPLAINED` | 10 | ✅ |
| `SUPPRESSED` | 10 | ✅ |
| `REJECTED` | 10 | ✅ |
| `CANCELLED` | 10 | ✅ |

**Rules:**

- Higher rank always wins over lower rank.
- `DELIVERED` (6) will not be overwritten by `SENT` (5).
- Terminal states (rank 10) are never downgraded.
- For same-rank events, later events are accepted (`>=` comparison).

**Ordering recommendation:** When displaying event timelines, sort by `occurredAt` (`created_at`), not arrival order.

## Processing side effects

| Internal event | Database updates | Suppression |
|----------------|-----------------|-------------|
| `EMAIL_SENT` | `EmailMessage.status` → `SENT`; `EmailDeliveryEvent` created | — |
| `EMAIL_DELIVERED` | Status → `DELIVERED` | — |
| `EMAIL_DELAYED` | Status → `DELAYED` | — |
| `EMAIL_BOUNCED` | Status → `BOUNCED` | Hard bounce (`Permanent`) → `EmailSuppression` |
| `EMAIL_COMPLAINED` | Status → `COMPLAINED` | Always → `EmailSuppression` |
| `EMAIL_FAILED` | Status → `FAILED` | — |
| `EMAIL_OPENED` | Status → `OPENED` | — |
| `EMAIL_CLICKED` | Status → `CLICKED` | — |
| `EMAIL_SUPPRESSED` | Status → `SUPPRESSED` | → `EmailSuppression` |
| `DOMAIN_VERIFIED` | No email status change | — |
| `DOMAIN_FAILED` | No email status change | — |
| `UNKNOWN` | Webhook stored; no email update | — |

### Correlation path

```
svix-id → ProviderWebhookEvent.externalEventId
data.email_id → ProviderOutboundSend.providerMessageId
              → EmailMessage.providerMessageId
```

If `providerMessageId` is not found, the webhook is still stored and marked `PROCESSED` but no email record is updated.

## Recommended webhook subscription

Minimum events for production:

```
email.sent
email.delivered
email.bounced
email.complained
email.failed
email.delivery_delayed
email.suppressed
domain.updated
suppression.added
```

Optional (engagement tracking):

```
email.opened
email.clicked
```

## Unmapped / future events

| Resend `type` | Planned handling |
|---------------|-----------------|
| `email.received` | Inbound email processing (future task) |
| `email.scheduled` | Scheduled send status tracking |
| `suppression.removed` | Remove from `EmailSuppression` |
| `contact.*` | Marketing audience sync |

## Implementation reference

| File | Responsibility |
|------|---------------|
| `src/server/providers/resend/resend-normalizer.ts` | `EVENT_TYPE_MAP`, normalization, precedence |
| `src/server/providers/resend/resend-webhook.ts` | Signature verification, payload parsing |
| `src/server/providers/resend/resend-types.ts` | `RESEND_WEBHOOK_EVENT_TYPES` constant |
| `src/server/services/resend-webhook-processor-service.ts` | Status updates, suppression |
| `src/server/services/provider-webhook-service.ts` | Ingestion, deduplication, routing |

## Related documentation

- [RESEND_CAPABILITY_AUDIT.md](./RESEND_CAPABILITY_AUDIT.md)
- [RESEND_SECURITY_REVIEW.md](./RESEND_SECURITY_REVIEW.md)
- [../PROVIDER_WEBHOOK_STANDARD.md](../PROVIDER_WEBHOOK_STANDARD.md)
