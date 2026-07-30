# Meta Ads Management

Task 5.5 introduces controlled Meta (Facebook + Instagram) campaign management.

## Architecture

```
AdvertisingCampaignPlan (approved)
  → AdvertisingMetaAdsAccount (explicit asset selection)
  → AdvertisingMetaAdsDraft
  → AdvertisingMetaAdsMutationPlan (SHA-256 hash)
  → AdvertisingMetaAdsLaunchApproval (8 gates)
  → AdvertisingMetaAdsLaunch
  → AdvertisingMetaAdsProviderResource
  → MarketingCampaign
```

## Asset selection

Users must explicitly select:

- Business (optional metadata)
- Ad account
- Facebook Page
- Instagram account (when IG placements used)
- Pixel / dataset

API: `GET /api/brands/[brandId]/advertising/meta/assets`  
Assign: `POST .../meta/accounts` with `{ action: "assign", ... }`

## Provider draft

Maps approved plan to Campaign → Ad Set → Ad → Creative structure with objective translation.

`POST .../meta/drafts` `{ action: "create-from-plan", planId }` — no API mutations.

## Mutation plan & launch

Same hash-bound approval workflow as Google Ads (Task 5.4):

1. `build-mutation-plan`
2. `request-approvals` / `approve-gate`
3. `create-launch` / `execute-launch`

## CAPI foundation

`POST .../meta/launches` `{ action: "queue-capi-event", ... }` queues consent-aware server events with deduplication.

## UI routes

- `/advertising/meta`
- `/advertising/meta/accounts`
- `/advertising/meta/assets`
- `/advertising/meta/drafts`
- `/advertising/meta/launches`
- `/advertising/meta/campaigns/[campaignId]`
- `/advertising/meta/review`

## Permissions

`advertisingMetaAds.read|connect|draft|validate|launch|manage`
