# Content Decay

Content decay is identified using **multiple evidence signals** — never based on page age alone.

## Signals

| Signal | Weight | Evidence |
|--------|--------|----------|
| Declining clicks | 0.25 | GSC click trend over observation window |
| Declining impressions | 0.20 | GSC impression trend |
| Declining ranking | 0.25 | Position trend (higher = worse) |
| Lower CTR | 0.15 | CTR trend decline |
| Stale content | 0.10 | Only when combined with other signals + >365 days since update |
| Broken links | 0.10 | Crawl issues on page |
| Outdated references | 0.10 | Detected stale references |
| Competitor coverage increase | 0.15 | Competitor intelligence signals |
| Unresolved on-page issues | 0.10 | Open on-page audit findings |
| Internal link loss | 0.10 | Reduced incoming internal links |

## Thresholds

- Minimum **2 signals** required to flag as refresh candidate (`DECAY_MIN_SIGNALS`)
- Decay score = sum of signal weights (capped at 1.0)
- Observation window: 28 days default

## What is NOT decay

- Page age alone without performance decline
- Single-day rank fluctuation
- Seasonal impression variation without sustained decline
- Missing GSC data (treated as unknown, not zero)

## Model

`SeoContentRefreshCandidate` stores:
- `decayScore`, `signals`, `evidence`
- `dateRangeStart`, `dateRangeEnd`
- Link to `SeoCrawlPage` and optional `SeoRankTrackingProject`
