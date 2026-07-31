# Form Consent

## Consent purposes

| Purpose | Required for submission? |
|---------|------------------------|
| SERVICE_REQUEST | Yes (when block present) |
| MARKETING_EMAIL | No |
| MARKETING_PHONE | No |
| PERSONALISED_MARKETING | No |
| ADVERTISING_AUDIENCE | No |
| PARTNER_COMMUNICATIONS | No |

## Separation rule

Optional marketing consent cannot substitute for required service request consent. `validateConsentSubmissions()` enforces this.

## Stored per submission

- `purpose`
- `state` (GRANTED / DENIED / WITHDRAWN)
- `wordingVersion` — must match `LeadCaptureConsentBlock.wordingVersion`
- `source` — defaults to `FORM`
- `formVersionId`
- `createdAt`

## Consent blocks

Defined per form version in `LeadCaptureConsentBlock`. Each block has:
- Label and help text (no executable HTML)
- `isRequired` flag
- `wordingVersion` for audit trail

## Withdrawal

`withdrawnAt` field supports future withdrawal workflows. Not auto-processed in Task 6.2.

## IP evidence

IP-derived evidence policy: store hashed IP only (`clientIpHash`). Raw IP not persisted in submission record.
