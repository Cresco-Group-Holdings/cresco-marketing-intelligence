# LinkedIn Ads Management

Controlled LinkedIn advertising campaign management using official Marketing API only.

## Flow

```
AdvertisingCampaignPlan → Account assignment → Draft → MutationPlan (SHA-256) → 8 approval gates → Launch → ProviderResources → MarketingCampaign
```

## Hierarchy

Campaign Group → Campaign → Creative

## Supported objectives

- Website visits
- Lead generation
- Engagement

## Targeting

Approved: country, region, language, industry, job function, seniority, company size, interest, broad, retargeting, exclusions.

Prohibited: age, gender, race, religion (discriminatory employment targeting).

## Safety

- Plan budget limits enforced
- Account currency must match
- No autonomous launch
- No autonomous budget increase
- Material changes invalidate approval

## API routes

- `GET/POST /api/brands/[brandId]/advertising/linkedin/accounts`
- `GET/POST /api/brands/[brandId]/advertising/linkedin/drafts`
- `POST /api/brands/[brandId]/advertising/linkedin/drafts/[draftId]` — `build-mutation-plan`
- `GET/POST /api/brands/[brandId]/advertising/linkedin/launches`

## UI

- `/advertising/linkedin`
- `/advertising/linkedin/drafts`
- `/advertising/linkedin/launches`
