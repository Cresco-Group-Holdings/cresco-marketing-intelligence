# Rank Tracking Limitations

## Data limitations

- **GSC delay**: Search Console data is typically 2–3 days behind real time
- **Average position**: GSC reports average position, not exact rank for every query
- **Sampling**: Low-impression queries may have incomplete data
- **Missing data**: Null ranks are not treated as position zero
- **No scraping**: Rank data must come from licensed/official sources only

## Quota controls

- Each `SeoRankTrackingProject` has a `keywordQuota` (default 100)
- Adding keywords beyond quota returns `QUOTA_EXCEEDED` error
- Plan-based quota enforcement should be configured per organisation tier

## Volatility thresholds

- Minimum 3 observations required before volatility signals fire
- Large position movement: ≥5 positions
- Significant rank loss alert: ≥10 positions with minimum impression volume
- Alert cooldown: 24 hours between duplicate alerts per keyword

## Content decay limitations

- Decay detection requires at least 2 corroborating signals
- Age alone does not trigger decay classification
- Competitor coverage signals depend on Task 4.3 competitor data availability
- On-page issue signals depend on Task 4.7 audit coverage

## No guarantees

- Rank tracking shows historical visibility — improvements are not guaranteed
- Refresh recommendations are evidence-based suggestions, not automated fixes
- Measurement plans require sufficient post-implementation observation period (28+ days recommended)

## Provider freshness

- Projects with `lastSyncAt` older than 7 days are considered stale
- Provider sync failures generate `PROVIDER_SYNC_FAILURE` rank changes
