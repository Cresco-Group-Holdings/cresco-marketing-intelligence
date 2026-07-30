# Advertising Optimisation Evidence

Every optimisation run persists an `AdvertisingOptimisationEvidence` record with the following fields.

## Required Evidence Fields

| Field | Description |
|-------|-------------|
| `dateRangeStart` / `dateRangeEnd` | Primary analysis window |
| `comparisonPeriodStart` / `comparisonPeriodEnd` | Optional comparison window |
| `provider` | Advertising provider (if scoped) |
| `accountId` | Provider account ID |
| `campaignId` | Campaign ID |
| `metrics` | Computed metrics: impressions, clicks, spend, conversions, revenue, CTR, CPC, CPA, ROAS, conversion rate |
| `metricDefinitions` | Human-readable definitions for each metric |
| `currency` | Account/native currency |
| `attributionModel` | Attribution model used (e.g. last_click) |
| `freshnessHours` | Provider data age in hours |
| `qualityWarnings` | Data quality warnings |
| `minimumVolume` | Required minimum impressions |
| `minimumVolumeMet` | Whether minimum volume threshold was met |
| `activeExperimentStatus` | Status of any active experiment |
| `recentMaterialChanges` | Recent campaign/creative/audience changes |

## Derived Metrics

```
ctr = (clicks / impressions) × 100
cpc = spend / clicks
cpa = spend / conversions
roas = revenue / spend
conversionRate = (conversions / clicks) × 100
```

## Evidence Builder

`buildEvidencePackage()` in `src/lib/advertising-optimisation/evidence.ts` constructs the package from `AnalysisInput`.

## Usage

Evidence is attached to every run and displayed on the recommendation detail page. Recommendations reference evidence strength, sample-size state, and data-quality state derived from the evidence package.
