# SEO Brief Evidence

Evidence sources and limitations for brief generation.

## Available evidence

| Source | Usage |
|--------|-------|
| Keywords | Primary/secondary with intent from Task 4.2 |
| Search Console | Impressions and position when synced |
| Topic cluster | Member keywords and cluster name from Task 4.4 |
| Target page | Crawl snapshot title, word count from Task 4.1 |
| Competitor pages | Truncated title/structure from Task 4.3 (max 200 chars) |
| Brand Knowledge | Brand context for grounding |
| Internal link graph | Crawl page relationships |

## SERP evidence

SERP data is only recorded when licensed or publicly observed:

```json
{
  "query": "email marketing tips",
  "observedAt": "2026-07-15T00:00:00Z",
  "hasCurrentData": true,
  "note": "SERP observation from provider"
}
```

When `hasCurrentData: false`, the brief includes an explicit limitation: **do not claim current SERP analysis**.

## Competitor evidence rules

- Excerpts truncated to 200 characters
- Headings sanitised to 120 characters
- Coverage and gap notes only — no full outline reproduction
- Disclaimer appended to all briefs with competitor data

## Missing evidence

The `assembleEvidenceLimitations()` function documents:

- No Search Console data
- No current SERP observation
- No competitor evidence
- Limited Brand Knowledge

Missing metrics are **never fabricated** as defaults.
