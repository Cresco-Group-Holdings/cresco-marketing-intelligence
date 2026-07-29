# Organic Growth Intelligence (Task 2.12)

The Organic Growth Intelligence Engine turns real social analytics into evidence-backed content recommendations for Cresco Grants Intelligence and Capital Cresco Terminal.

## Architecture

```
SocialPostMetric / SocialAccountMetric
        ↓
socialAnalyticsQueryService (tenant-scoped fetch)
        ↓
growth-intelligence-service
  ├── baselines (deterministic)
  ├── content patterns (correlation, not causation)
  ├── insight-engine (12 insight types, minimum thresholds)
  └── recommendations (deterministic actions)
        ↓
Optional: AI explanation (ANALYTICS_INSIGHT) — explains only supplied evidence
```

## Insight types

- `HIGH_PERFORMING_TOPIC`, `HIGH_PERFORMING_FORMAT`
- `LOW_ENGAGEMENT`, `STRONG_HOOK`, `WEAK_CTA`
- `POSTING_GAP`, `BEST_PUBLISHING_WINDOW`
- `AUDIENCE_GROWTH`, `DECLINING_REACH`, `VIDEO_RETENTION_DROP`
- `CHANNEL_OPPORTUNITY`, `REPURPOSING_OPPORTUNITY`

When data is below minimum thresholds, insights are stored with `dataStatus: INSUFFICIENT` and summary **"Not enough data yet"**. No metrics are invented.

## Baselines

Computed deterministically per analysis run:

- Previous period
- Moving average
- Brand median
- Channel median (per provider, minimum 3 posts)
- Content-type median
- Campaign median

Cross-provider comparisons use per-channel medians only — raw metrics are never merged across incompatible providers.

## API routes

| Route | Method | Permission |
|-------|--------|------------|
| `/api/brands/[brandId]/growth` | GET | `growth.read` |
| `/api/brands/[brandId]/growth` | POST | `growth.generate` |
| `/api/brands/[brandId]/growth/insights` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/recommendations` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/recommendations/[id]` | POST | feedback / draft / explain |
| `/api/brands/[brandId]/growth/experiments` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/baselines` | GET | `growth.read` |

## UI

- `/growth` — overview and analysis controls
- `/growth/insights` — evidence-backed insights
- `/growth/recommendations` — actionable recommendations with feedback loop
- `/growth/experiments` — experiments converted from recommendations

## Feedback loop

Users mark recommendations: `ACCEPTED`, `DISMISSED`, `PLANNED`, `IMPLEMENTED`, `SUCCESSFUL`, `UNSUCCESSFUL`, `INCONCLUSIVE`. Outcomes are stored in `RecommendationOutcome` with optional measured results. The system does not claim AI "learning" without this measurable feedback.

## Draft creation

Authorised users (`growth.generate`) may convert recommendations into:

- ContentItem idea (`CONTENT_IDEA`)
- Content Studio brief (`STUDIO_BRIEF`)
- Growth experiment (`EXPERIMENT`)
- Calendar placeholder (`CALENDAR_PLACEHOLDER` — requires `socialAccountId`, `scheduledFor`, `timezone`)

Content is never auto-published.

## Permissions

- `growth.read` — OWNER, ADMIN, MARKETER, ANALYST
- `growth.generate` — OWNER, ADMIN, MARKETER

## Testing

```bash
npm run test:unit -- growth
npm run test:integration -- growth
```
