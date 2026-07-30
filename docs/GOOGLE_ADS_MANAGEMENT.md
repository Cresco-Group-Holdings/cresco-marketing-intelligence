# Google Ads Management

Task 5.4 introduces controlled Google Ads campaign management for approved Search campaigns.

## Architecture

```
AdvertisingCampaignPlan (approved)
  → AdvertisingGoogleAdsDraft (local payload, no mutations)
  → AdvertisingGoogleAdsMutationPlan (immutable, hashed)
  → AdvertisingGoogleAdsLaunchApproval (8 gates, hash-bound)
  → AdvertisingGoogleAdsLaunch (idempotent execution)
  → AdvertisingGoogleAdsProviderResource (provider IDs)
  → MarketingCampaign (Stage 3 sync)
```

## Connection

Reuse Stage 3 OAuth (`GOOGLE_ADS` connector). Brand assignment stored in `AdvertisingGoogleAdsAccount`:

- Manager customer ID (optional MCC)
- Client customer ID
- Currency, timezone, access level
- Test account flag

API: `POST /api/brands/[brandId]/advertising/google/accounts` with `assign`, `disconnect`, `list-accounts`.

## Draft generation

`POST .../google/drafts` with `{ action: "create-from-plan", planId }` converts an approved plan into a Google-specific draft. Also upserts `AdvertisingCampaignProviderDraft` for cross-provider consistency.

No Google API mutations occur during draft generation.

## Mutation plan

`POST .../google/drafts/[draftId]` with `{ action: "build-mutation-plan" }` creates an immutable `AdvertisingGoogleAdsMutationPlan` with SHA-256 hash. Approval must match exact hash.

## Launch workflow

1. Request approvals (`POST .../launches` `request-approvals`)
2. Approve each gate (`approve-gate`) — CAMPAIGN, CREATIVE, COMPLIANCE, BUDGET, CONVERSION, ACCOUNT_PERMISSION, PROVIDER_VALIDATION, FINAL_LAUNCH
3. Validate mutation (`validate-mutation`) using `validateOnly`
4. Create launch record (`create-launch`)
5. Execute (`execute-launch`) — idempotent via `idempotencyKey`

## Safe management

`POST .../google/campaigns/[campaignId]` supports `preview-pause`, `confirm-pause`, `preview-budget` with audit trail in `AdvertisingGoogleAdsOperation`.

## UI routes

- `/advertising/google`
- `/advertising/google/accounts`
- `/advertising/google/drafts`
- `/advertising/google/launches`
- `/advertising/google/campaigns/[campaignId]`
- `/advertising/google/operations`

## Permissions

| Permission | Capability |
|---|---|
| `advertisingGoogleAds.read` | View accounts, drafts, launches |
| `advertisingGoogleAds.connect` | Assign/disconnect accounts |
| `advertisingGoogleAds.draft` | Create drafts and mutation plans |
| `advertisingGoogleAds.validate` | Run validate-only checks |
| `advertisingGoogleAds.launch` | Approvals and execution |
| `advertisingGoogleAds.manage` | Pause, budget preview |
