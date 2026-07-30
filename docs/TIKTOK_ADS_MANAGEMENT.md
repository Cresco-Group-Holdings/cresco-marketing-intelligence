# TikTok Ads Management

Controlled TikTok advertising campaign management using official Marketing API v1.3 only.

## Flow

```
AdvertisingCampaignPlan → Account assignment → Draft → MutationPlan (SHA-256) → 8 approval gates → Launch → ProviderResources → MarketingCampaign
```

## Hierarchy

Campaign → Ad Group → Ad

## Supported objectives

- Traffic
- Video views
- Lead generation
- Website conversions

## Targeting

Approved: country, language, interest, broad audience, retargeting, age 18+, exclusions.

Prohibited: sensitive interests, Spark Ads without authorisation.

## Safety

- Plan budget limits enforced
- Account currency must match
- No autonomous launch
- No hidden targeting expansion
- Spark Ads capability gate disabled

## API routes

- `GET/POST /api/brands/[brandId]/advertising/tiktok/accounts`
- `GET/POST /api/brands/[brandId]/advertising/tiktok/drafts`
- `POST /api/brands/[brandId]/advertising/tiktok/drafts/[draftId]` — `build-mutation-plan`
- `GET/POST /api/brands/[brandId]/advertising/tiktok/launches`

## UI

- `/advertising/tiktok`
- `/advertising/tiktok/drafts`
- `/advertising/tiktok/launches`
