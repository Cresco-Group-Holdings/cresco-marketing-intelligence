# Google Ads Launch Approval

## Required gates

All eight gates must be `APPROVED` with a `planHash` matching the current mutation plan:

1. **CAMPAIGN** — strategy and targeting reviewed
2. **CREATIVE** — RSA copy and assets approved
3. **COMPLIANCE** — brand/regulatory compliance signed off
4. **BUDGET** — daily budget within approved limits
5. **CONVERSION** — conversion tracking readiness confirmed
6. **ACCOUNT_PERMISSION** — OAuth and account access verified
7. **PROVIDER_VALIDATION** — validate-only mutate passed
8. **FINAL_LAUNCH** — explicit human launch confirmation

## Hash binding

Each approval stores `planHash` at decision time. If the mutation plan is rebuilt (any operation or payload change), prior approvals become **stale** and must be re-granted.

## Material changes

The following invalidate prior launch approval:

- Draft regeneration from plan
- New mutation plan build
- Budget amount change in draft
- Keyword/creative/destination changes
- Account reassignment

## Roles

Only users with `advertisingGoogleAds.launch` may approve gates or execute launches. Marketers may draft and validate but cannot launch by default.

## AI output

AI-generated plans or copy never satisfy approval gates automatically. Human approver `userProfileId` is recorded on each gate.
