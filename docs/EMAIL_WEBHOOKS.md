# Email Webhooks

## Security

- **Signature verification** — HMAC-SHA256 per provider adapter
- **Replay protection** — rejects events older than last processed timestamp
- **Idempotency** — `providerEventId` + `eventType` unique constraint
- **Raw payload restriction** — only normalised fields stored in `EmailDeliveryEvent.metadata`

## Supported events

`DELIVERED`, `DEFERRED`, `BOUNCED`, `COMPLAINED`, `OPENED`, `CLICKED`, `UNSUBSCRIBED`, `REJECTED`

## Processing

`POST /api/brands/{brandId}/email` with `action: "processWebhook"`:

```json
{
  "providerConnectionId": "...",
  "payload": "{...}",
  "signature": "...",
  "secret": "..."
}
```

## Side effects

| Event | Action |
|-------|--------|
| BOUNCED (hard) | Create `EmailBounce`, add suppression |
| COMPLAINED | Create `EmailComplaint`, add suppression, may trigger shutdown |
| UNSUBSCRIBED | Add suppression + unsubscribe record |
| DELIVERED | Update delivery event timeline |

Event timestamps from the provider are preserved in `occurredAt`.
