# Ad Experiment Metrics

Supported metrics with provider attribution preservation.

## Supported metrics

| Key | Description |
|---|---|
| `impressions` | Ad impressions |
| `clicks` | Ad clicks |
| `ctr` | Click-through rate (derived) |
| `cpc` | Cost per click (derived) |
| `conversions` | Conversion events |
| `conversion_rate` | Conversion rate (derived) |
| `cpa` | Cost per acquisition (derived) |
| `revenue` | Revenue attributed |
| `roas` | Return on ad spend (derived) |
| `qualified_leads` | Qualified lead events |
| `trial_starts` | Trial start events |
| `subscriptions` | Subscription events |

## Metric roles

- **PRIMARY** — exactly one per experiment; drives the decision rule
- **GUARDRAIL** — must not degrade when adopting a winner
- **SECONDARY** — informational only

## Attribution

Each metric may include:
- `attributionDefinition` — how the metric is defined internally
- `providerMetricName` — provider-specific metric name

Provider attribution windows and definitions are preserved in observations via `providerAttributionWindow`.

## Derived metrics

CTR, CPC, conversion rate, CPA, and ROAS are computed from raw observations when sufficient data exists. Derived calculations do not override provider-reported values when available.

## Observations

`AdvertisingExperimentObservation` records time-bucketed values with:
- `rawValue` — metric value
- `sampleSize` — impressions or relevant denominator
- `isStale` — data freshness flag
- `dataSource` — origin (e.g. `provider_reporting`)
