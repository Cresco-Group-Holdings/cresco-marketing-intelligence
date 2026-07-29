# Organic Growth Intelligence (Task 2.12)

The Organic Growth Intelligence Engine turns real social analytics into evidence-backed content recommendations for Cresco Grants Intelligence and Capital Cresco Terminal.

## Architecture

```
SocialPostMetric / SocialAccountMetric
        ↓
socialAnalyticsQueryService (tenant-scoped fetch)
        ↓
growth-intelligence-service (single DB transaction)
  ├── GrowthAnalysisRun (durable run + idempotency key)
  ├── baselines (deterministic)
  ├── content patterns (correlation, not causation)
  ├── insight-engine (12 insight types, minimum thresholds)
  └── recommendations (deterministic actions)
        ↓
Optional: growth-explanation-service (ANALYTICS_INSIGHT) — explain-only, whitelist validated
```

## Analysis run transaction semantics

Each `POST /api/brands/[brandId]/growth` analysis executes inside **one Prisma transaction**:

1. Upsert `GrowthAnalysisRun` (`RUNNING`) keyed by `brandId + analysisPeriodStart + analysisPeriodEnd`
2. Supersede all active `GrowthInsight` rows (`supersededAt`)
3. Mark all `ACTIVE` `GrowthRecommendation` rows as `SUPERSEDED`
4. Replace `PerformanceBenchmark` and `ContentPattern` rows for the brand
5. Create 12 insights (one per insight type), nested evidence, and sufficient recommendations
6. Mark the analysis run `COMPLETED`

If any step fails, the transaction rolls back completely. Historical outcomes and experiments are never deleted.

### Idempotency and superseding

| Key | Format |
|-----|--------|
| Analysis run | `{brandId}:{periodStart}:{periodEnd}` |
| Insight | `{analysisRunKey}:{insightType}` |
| Recommendation | `{insightKey}:recommendation` |

Partial unique indexes enforce:

- One active insight per `brandId + idempotencyKey` (`supersededAt IS NULL`)
- One active recommendation per `brandId + insightType + analysis window`

Re-running the same window without `force=true` returns the cached completed run. `force=true` supersedes prior active rows and replaces them atomically.

## Insight types

- `HIGH_PERFORMING_TOPIC`, `HIGH_PERFORMING_FORMAT`
- `LOW_ENGAGEMENT`, `STRONG_HOOK`, `WEAK_CTA`
- `POSTING_GAP`, `BEST_PUBLISHING_WINDOW`
- `AUDIENCE_GROWTH`, `DECLINING_REACH`, `VIDEO_RETENTION_DROP`
- `CHANNEL_OPPORTUNITY`, `REPURPOSING_OPPORTUNITY`

When data is below minimum thresholds, insights are stored with `dataStatus: INSUFFICIENT` and summary **"Not enough data yet"**.

## Real topic and offer dimensions

| Dimension | Primary source | Fallback |
|-----------|----------------|----------|
| `topic` | `ContentProvenance.metadata.topic` | `ContentItem.title` → `primaryMessage` → `campaignName` → `contentPillar` |
| `offer` | `ContentProvenance.metadata.offerId` → `BrandOffer` | `campaignName` matched to `BrandOffer.name` |

Legacy content without provenance linkage still receives documented fallback values. Correlation disclaimers remain on all pattern outputs.

## Recommendation lifecycle

Allowed transitions:

- Initial: `ACCEPTED`, `DISMISSED`, `PLANNED`
- `ACCEPTED` → `PLANNED`, `IMPLEMENTED`, `DISMISSED`
- `PLANNED` → `IMPLEMENTED`, `DISMISSED`, `ACCEPTED`
- `IMPLEMENTED` → `SUCCESSFUL`, `UNSUCCESSFUL`, `INCONCLUSIVE` (requires `measuredOutcome`)
- Terminal: `DISMISSED`, `SUCCESSFUL`, `UNSUCCESSFUL`, `INCONCLUSIVE`

Feedback rules:

- Duplicate status submissions are rejected
- Only one `isEffective` outcome per recommendation (history retained)
- `latestFeedbackStatus` and `latestOutcomeId` updated on each valid transition
- `IMPLEMENTED` links to `draftExperimentId` when present

## AI explanation layer

- Uses `aiModelRegistry.resolveModel()` (production provider when configured, registry fallback otherwise)
- Never calculates metrics — only explains supplied deterministic evidence
- `validateGrowthAiExplanation()` enforces evidence-key whitelist and numeric whitelist derived from source metrics/evidence JSON
- Provider or validation failure falls back to `buildDeterministicExplanation()` with `explanationSource: DETERMINISTIC_FALLBACK`

## Draft creation flows

Authorised users (`growth.generate`) may convert recommendations into:

| Type | Result |
|------|--------|
| `CONTENT_IDEA` | `ContentItem` in `IDEA` status |
| `STUDIO_BRIEF` | `ContentItem` + provenance growth brief metadata |
| `EXPERIMENT` | `GrowthExperiment` (`PLANNED`) |
| `CALENDAR_PLACEHOLDER` | `ContentItem` + `ContentVariant` + `ContentSchedule` (`DRAFT`) |

No draft action auto-publishes content.

## API routes

| Route | Method | Permission |
|-------|--------|------------|
| `/api/brands/[brandId]/growth` | GET | `growth.read` |
| `/api/brands/[brandId]/growth?force=true` | POST | `growth.generate` |
| `/api/brands/[brandId]/growth/insights` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/insights/[id]?action=explain` | POST | `growth.generate` |
| `/api/brands/[brandId]/growth/recommendations` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/recommendations/[id]` | POST | feedback / draft / explain |
| `/api/brands/[brandId]/growth/experiments` | GET | `growth.read` |
| `/api/brands/[brandId]/growth/baselines` | GET | `growth.read` |

## Permissions

- `growth.read` — OWNER, ADMIN, MARKETER, ANALYST
- `growth.generate` — OWNER, ADMIN, MARKETER

## Known provider limitations

- When no external AI provider is configured, the model registry resolves to `MOCK` and explanations still pass through whitelist validation.
- If the provider fails or output validation fails, the UI receives a deterministic fallback explanation rather than invented statistics.

## Testing

```bash
npm run test:unit -- growth
npm run test:integration -- growth
npm run test:database -- growth
```

Database suite requires `ANALYTICS_TEST_DATABASE_URL`.
