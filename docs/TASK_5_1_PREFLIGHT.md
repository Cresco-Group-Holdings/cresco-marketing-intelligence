# Task 5.1 Pre-flight Audit

## Reusable models (reference only — do not duplicate)

| Model | Role | Reuse in 5.1 |
|-------|------|--------------|
| `MarketingCampaign` | Warehouse synced campaign | Optional future link via `providerDraft`; NOT planning entity |
| `MarketingAdGroup` / `MarketingAd` / `MarketingCreative` | Warehouse dimensions | Post-publish only |
| `MarketingAudience` | Provider-synced audience | Reference for eligibility; planning uses `BrandAudience` |
| `MarketingConversionDefinition` | Conversion registry | FK on `AdvertisingCampaignConversionGoal` |
| `MarketingObjective` | Brand KPI goals (onboarding) | Optional FK on `AdvertisingCampaignObjective` |
| `BrandAudience` | ICP definition | FK on `AdvertisingCampaignAudiencePlan` |
| `MarketingAsset` | DAM library | FK on `AdvertisingCampaignCreativePlan` |
| `ContentItem` / `ContentVariant` | Content operations | FK on creative plans |
| `SeoCrawlPage` | Crawled pages | Destination verification |

## Naming conflicts resolved

- **`MarketingCampaign`** ≠ **`AdvertisingCampaignPlan`** — planning is internal; warehouse is imported performance
- **`MarketingObjective`** (brand KPI) ≠ **`AdvertisingPlanObjectiveType`** (ad platform objective)
- **`MarketingAudience`** (provider) ≠ **`AdvertisingCampaignAudiencePlan`** (planning spec)

## Provider adapters (Stage 3.5)

- Google Ads, Meta, LinkedIn, TikTok connectors exist for **sync only**
- `paid-ads-sync-service.ts`, `paid-ads-connection-service.ts`
- No publish API in this task

## Approval infrastructure

- Pattern: `SeoBriefApproval` → `AdvertisingCampaignApproval`
- Separate approval types: STRATEGY, BUDGET, AUDIENCE, CREATIVE, COMPLIANCE, LAUNCH
- Stage 2 `ContentApproval` for content items linked via creative plans

## Conversion tracking dependencies

- `MarketingConversionDefinition` for goal registry
- Server-side tracking via Stage 3.2 `TrackingProperty`
- GSC/warehouse metrics for measurement context

## Architectural separation

1. **Internal campaign plan** — `AdvertisingCampaignPlan`
2. **Provider draft** — `AdvertisingCampaignProviderDraft` (validation only)
3. **Published provider entity** — `MarketingCampaign` (future task)
4. **Imported performance** — warehouse metrics (existing)

## Deferred technical debt

- DNS rebinding (Stage 4)
- Plan-tier billing quotas
- Provider publish API (Task 5.2+)
- Customer list upload
- Currency conversion (store original currency only)

## Current limitations

- No automatic provider publishing
- No customer list upload
- No currency conversion without stored rate
- AI does not fabricate forecasts
