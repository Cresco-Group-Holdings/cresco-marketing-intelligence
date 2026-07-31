# Server-Side Events

Server-side events provide authoritative conversion tracking with API key authentication and HMAC request signing.

## Endpoint

```
POST /api/tracking/v1/server-events
```

## Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `x-cresco-api-key` | Tracking API key (`ctk_...`) |
| `x-cresco-signature` | SHA-256 hex of `{apiKey}:{rawBody}` |

## Payload

```json
{
  "propertyId": "prop_abc123",
  "eventName": "signup_complete",
  "occurredAt": "2026-07-30T12:00:00.000Z",
  "userId": "user_123",
  "leadId": "lead_456",
  "customerId": "cus_789",
  "idempotencyKey": "signup_user_123",
  "properties": {
    "plan": "starter"
  }
}
```

## Node.js example

```javascript
import { createHash } from "node:crypto";

const apiKey = process.env.CRESCO_TRACKING_API_KEY;
const payload = JSON.stringify({
  propertyId: "prop_abc123",
  eventName: "subscription_start",
  occurredAt: new Date().toISOString(),
  userId: "user_123",
  customerId: "cus_789",
  idempotencyKey: "subscription_user_123",
  properties: { plan: "pro", interval: "monthly" },
});

const signature = createHash("sha256").update(`${apiKey}:${payload}`).digest("hex");

const response = await fetch("https://app.crescogroup.uk/api/tracking/v1/server-events", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-cresco-api-key": apiKey,
    "x-cresco-signature": signature,
  },
  body: payload,
});
```

## Supported server events

- `signup_complete`
- `email_verified`
- `trial_start`
- `demo_request`
- `subscription_start`
- `purchase`
- `login_complete`
- Product events (`grant_application_created`, etc.)

## Identity linking

Server events may include:

- `userId` — authenticated application user
- `leadId` — CRM lead reference (server-resolved)
- `customerId` — Stripe or CRM customer reference

Identity links are created deterministically server-side. Never send raw email addresses in analytics payloads.

## API key management

Generate keys from the tracking property API (`POST /api/tracking/properties/{id}`) or dashboard. Keys are shown once at creation and stored as SHA-256 hashes.

## Security

- API keys are scoped to a single tracking property
- Signatures prevent payload tampering
- Tenant IDs are never accepted from client payloads
- Invalid or expired keys return `401 Unauthorized`
