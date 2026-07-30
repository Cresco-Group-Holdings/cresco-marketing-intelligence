# SEO Priority Scoring

Versioned deterministic priority scores (`scoreVersion: "1.0"`).

## Factors

| Factor | Weight | Notes |
|--------|--------|-------|
| businessRelevance | 0.15 | Brand alignment |
| impressions | 0.15 | Normalised log scale from GSC |
| existingPosition | 0.10 | Higher score for positions 4–20 |
| conversionRelevance | 0.10 | When available |
| contentGap | 0.15 | From competitor gap evidence |
| competitorCoverage | 0.10 | When available |
| pageWeakness | 0.10 | When available |
| implementationEffort | 0.05 | Inverted — lower effort scores higher |
| strategicImportance | 0.10 | Cluster confidence or manual input |

## Missing data handling

- Factors without data are recorded in `missingFactors`
- Weights are renormalised across available factors only
- `totalScore` is `null` when no factors are available
- **No fabricated defaults** — missing external metrics are never imputed

## Usage

```
POST /api/brands/[brandId]/seo/clusters/[clusterId]?action=score
```

Returns persisted `SeoContentPriorityScore` with factor breakdown.

## Versioning

When the scoring formula changes, bump `PRIORITY_SCORE_VERSION` in `src/lib/topics/constants.ts`. Historical scores retain their version for comparison.
