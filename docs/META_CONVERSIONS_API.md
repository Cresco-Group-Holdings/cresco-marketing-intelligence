# Meta Conversions API (CAPI)

## Foundation (Task 5.5)

Server-side events queued via `advertisingMetaAdsCapiService.queueEvent`.

## Requirements

| Requirement | Implementation |
|---|---|
| Event deduplication | SHA-256 `event_id` from event name + browser ID + timestamp |
| Browser/server IDs | `browserEventId` stored; matches pixel `eventID` when provided |
| Consent state | `GRANTED` required; otherwise `SKIPPED_NO_CONSENT` |
| Data minimisation | Only hashed email/phone in payload |
| Hashing | SHA-256 normalised lowercase (Meta spec) |
| No raw PII in logs | `hashedUserData` JSON only; no email/phone in audit tables |

## Model

`AdvertisingMetaAdsCapiEvent` with unique `(metaAdsAccountId, eventId)` prevents duplicate sends.

## Endpoint

`POST /{pixel-id}/events` via Graph API when pixel configured and consent granted.

## Limitations

- Requires pixel selected on brand account
- Does not replace browser pixel implementation
- Failed sends recorded with `FAILED` status for retry (manual)
