# Form Submission Security

## Public endpoint

`POST /api/forms/v1/[publicFormId]/submit`

## Controls

| Control | Implementation |
|---------|----------------|
| Tenant resolution | Server-side via `publicFormId` only |
| Active form check | `status === ACTIVE` + active version |
| Origin validation | `allowedOrigins` allowlist |
| Rate limiting | 20/min, 100/hour per IP per form |
| Payload limits | 64KB max |
| Field count | 50 max |
| Unknown fields | Rejected |
| Idempotency | `X-Idempotency-Key` header or body field |
| HTML/scripts | Stripped/rejected in field values and labels |
| IP storage | Hashed (`clientIpHash`), not raw |

## Spam quarantine

Suspicious submissions are stored with `QUARANTINED` status — never auto-deleted.

Signals: honeypot, origin mismatch, velocity, bot signals, payload anomalies.

## Duplicate submissions

Idempotency key uniqueness per form prevents duplicate processing.

## Receipt

`receiptAt` timestamp stored on every submission.

## Never trust

- Browser-supplied `organisationId` or `brandId`
- Client-side tenant context
- Unvalidated redirect URLs

Redirect destinations must pass `validateRedirectUrl()` against form allowlist.
