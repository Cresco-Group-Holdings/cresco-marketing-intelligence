# Provider Webhook Standard

Standard for receiving, verifying, and processing provider webhooks in the Task 7.1 foundation. Webhook ingestion logic is implemented; the HTTP route and event processing pipeline are Task 7.2+.

## Principles

1. **Verify before process** — signature and timestamp checked before any side effects.
2. **Idempotent** — duplicate events are detected and acknowledged without reprocessing.
3. **No raw payload storage** — store SHA-256 digest only.
4. **Tenant resolution from payload** — never trust client-supplied tenant identifiers.
5. **Audit everything** — accepted and rejected events are logged.

## Ingestion Flow

```
Provider ──POST──► HTTP Route (7.2+) ──► providerWebhookService.ingestWebhook()
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              Validate provider        Check timestamp            Parse JSON
              + webhookSupport         (replay protection)        Extract event ID
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                                    Check idempotency (DB unique)
                                              │
                                              ▼
                                    Resolve tenant (externalAccountId)
                                              │
                                              ▼
                                    Verify HMAC signature
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                        VERIFIED                         REJECTED
                    (store event)                    (audit + reject)
```

## Signature Verification

Implementation: `src/lib/providers/webhook/verification.ts`

### HMAC Verification

```typescript
verifyHmacWebhookSignature({
  rawBody: string,       // raw request body (before JSON parse)
  signature: string,     // from provider header
  secret: string,        // webhook signing secret
  timestamp?: string,    // optional timestamp header
  algorithm?: "sha256" | "sha1",  // default: sha256
})
```

### Process

1. Compute `HMAC(algorithm, secret, rawBody)` → hex digest.
2. Strip prefix from provided signature (`sha256=` or `sha1=`).
3. Timing-safe buffer comparison.

### Signature Required

`providerWebhookService.ingestWebhook()` rejects webhooks without a valid signature:

| Condition | Error Code | HTTP Status |
|-----------|-----------|-------------|
| No signature provided | `SIGNATURE_REQUIRED` | 401 |
| Signature mismatch | `SIGNATURE_INVALID` | 401 |

The signing secret is retrieved from the connection's active webhook endpoint (`ProviderWebhookEndpoint.secretDigest`). In 7.2+, adapters will store the plaintext secret encrypted in `ProviderCredential` (type `WEBHOOK_SIGNING_SECRET`).

## Timestamp Validation (Replay Protection)

```typescript
isWebhookTimestampValid(timestamp, toleranceMs = 5 * 60 * 1000)
```

| Input | Behavior |
|-------|----------|
| No timestamp | Allowed (signature-only verification) |
| Unix seconds | Converted to ms if value < 1e12 |
| Unix milliseconds | Used directly |
| Outside 5-minute window | Rejected with `TIMESTAMP_OUT_OF_TOLERANCE` |

Providers should include a timestamp header (e.g. `X-Webhook-Timestamp`, `Stripe-Signature` t= parameter). Adapters in 7.2+ extract the timestamp from provider-specific headers.

## Idempotency

### Event ID Extraction

```typescript
extractWebhookEventId(payload)
// Checks: payload.id, payload.event_id, payload.eventId
```

### Database Constraint

```prisma
@@unique([providerKey, externalEventId])
```

### Duplicate Handling

If an event with the same `(providerKey, externalEventId)` already exists:

- Return `200` with message `"Duplicate event."`
- Do not reprocess.
- Do not create a new audit event.

This satisfies provider retry requirements while preventing double-processing.

## Tenant Resolution

Implementation: `providerWebhookService.resolveConnectionFromPayload()`

### Resolution Strategy

1. Extract `account_id` or `accountId` from webhook payload.
2. Query `ProviderConnection` where:
   - `providerKey` matches
   - `externalAccountId` matches
   - `status` in `["CONNECTED", "DEGRADED"]`
3. Load active webhook endpoint for signing secret.

### Security Properties

- **No client-supplied `organisationId`** — resolved server-side from stored connection.
- **Connection must be active** — `DRAFT`, `REVOKED`, etc. are excluded.
- **Unresolved payloads rejected** — `CONNECTION_NOT_RESOLVED` (404).

### Task 7.2+ Extensions

Provider-specific adapters may implement additional resolution strategies via `WebhookProviderAdapter`:

```typescript
// Adapter may override resolution for providers that use
// different payload shapes (e.g. Stripe customer ID, Meta page ID)
```

## Event Storage

### Accepted Events

```typescript
ProviderWebhookEvent {
  organisationId: string;      // from resolved connection
  connectionId: string;        // from resolved connection
  providerKey: string;
  externalEventId: string;     // from payload
  eventType: string;           // from payload.type
  status: "VERIFIED";
  payloadDigest: string;       // SHA-256 of raw body
  receivedAt: DateTime;
}
```

### Rejected Events

Stored only when `organisationId` is known (after partial resolution):

```typescript
ProviderWebhookEvent {
  status: "REJECTED";
  errorCode: string;           // e.g. SIGNATURE_INVALID
  payloadDigest: string;       // SHA-256 of raw body (no raw payload)
}
```

### Payload Digest

```typescript
digestWebhookPayload(rawBody) // SHA-256 hex
```

Raw webhook bodies are never stored. The digest enables deduplication analysis and forensic correlation without retaining PII or secrets.

## Event Status Lifecycle

```
RECEIVED → VERIFIED → PROCESSING → PROCESSED
                │                      │
                ▼                      ▼
            REJECTED              DEAD_LETTER
                │
                ▼
            DUPLICATE (detected at ingest, not stored as new row)
```

Task 7.1 creates events in `VERIFIED` or `REJECTED` status. Processing pipeline (7.2+) transitions through `PROCESSING` → `PROCESSED`.

## Webhook Endpoint Registration

```prisma
model ProviderWebhookEndpoint {
  connectionId: string;
  providerKey: string;
  url: string;              // our public webhook URL
  secretDigest: string?;    // for signature verification
  isActive: boolean;
  externalId: string?;      // provider-side webhook ID
}
```

Registration with the external provider (7.2+) is an adapter responsibility. The endpoint record links the connection to its signing secret and public URL.

### Public URL Pattern

```
{WEBHOOK_BASE_URL}/{providerKey}
// e.g. https://app.example.com/api/providers/webhooks/stripe
```

## Adapter Contract

```typescript
interface WebhookProviderAdapter {
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
  }): boolean;

  extractEventId(payload: unknown): string | null;
  extractEventType(payload: unknown): string | null;
  normalizeWebhookEvent(payload: unknown): Record<string, unknown>;
}
```

The foundation's `verifyHmacWebhookSignature()` handles standard HMAC-SHA256. Adapters for providers with custom schemes (e.g. Stripe's `v1` signature format) override `verifyWebhookSignature()`.

## Audit Events

| Action | When |
|--------|------|
| `WEBHOOK_RECEIVED` | Event verified and stored |
| `WEBHOOK_REJECTED` | Signature, timestamp, or validation failure |

Metadata includes `eventId` and `externalEventId` (redacted via `redactSecrets()`).

## Error Codes

| Code | Cause | HTTP |
|------|-------|------|
| `TIMESTAMP_OUT_OF_TOLERANCE` | Webhook timestamp too old/future | 400 |
| `INVALID_JSON` | Body is not valid JSON | 400 |
| `MISSING_EVENT_ID` | No id/event_id/eventId in payload | 400 |
| `CONNECTION_NOT_RESOLVED` | No matching connection for account ID | 404 |
| `SIGNATURE_REQUIRED` | No signature header provided | 401 |
| `SIGNATURE_INVALID` | HMAC verification failed | 401 |

## Providers with Webhook Support

From the registry (`webhookSupport: true`):

| Provider | Category |
|----------|----------|
| meta | Social |
| instagram, facebook | Social |
| tiktok, x, youtube | Social |
| meta-ads | Advertising |
| resend, sendgrid, postmark, amazon-ses | Email |
| stripe | Payments |

All are `enabled: false` in Task 7.1.

## Task 7.1 Status

| Component | Status |
|-----------|--------|
| `ingestWebhook()` service | Implemented |
| HMAC verification | Implemented |
| Timestamp validation | Implemented |
| Idempotency (unique constraint) | Implemented |
| Tenant resolution | Implemented (account_id/accountId) |
| HTTP webhook route | Not implemented (7.2+) |
| Event processing pipeline | Not implemented (7.2+) |
| Adapter-specific signature schemes | Contract defined (7.2+) |

## Related Documentation

- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_ADAPTER_GUIDE.md](./PROVIDER_ADAPTER_GUIDE.md)
- [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md)
