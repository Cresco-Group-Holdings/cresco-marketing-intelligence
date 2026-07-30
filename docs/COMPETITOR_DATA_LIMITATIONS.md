# Competitor Data Limitations

This document describes what the competitor search intelligence module can and cannot provide.

## Available data sources

| Source | Description |
|--------|-------------|
| Restricted public crawl | HTML structure from competitor registered domains |
| Manual keyword input | User-entered observations with date |
| CSV import | Bulk keyword observations (via manage API) |
| SERP observation | User-recorded SERP positions and URLs |
| Provider integration | Approved external provider data (when configured) |
| Brand keywords | From Search Console sync, manual entry, or import |
| Brand crawl | From technical SEO crawler snapshots |

## Not available

The platform does **not** provide and does **not** fabricate:

- Competitor traffic or sessions
- Competitor revenue or conversions
- Private Google Analytics or Search Console data
- Backlink counts or domain authority scores
- Search volume estimates derived from page text
- Ranking history without a recorded observation source
- Revenue impact projections

## AI analysis limitations

AI analysis (`seo.competitors.analyze`) receives:

- Overlap counts and gap summaries
- Topic inventory from public crawls
- Brand knowledge context

AI output must include:

- `evidence` — references to provided data
- `confidence` — per-opportunity score (0–1)
- `recommendedAction` — strategic guidance
- `originalityGuidance` — anti-copying instructions
- `limitations` — explicit data boundaries

AI does not receive full competitor page text. Headings in comparisons are truncated to 100 characters; excerpts to 500 characters.

## Source coverage

Overlap analysis reports `sourceCoverage` per keyword:

- `hasBrandData` / `hasCompetitorData`
- `brandSource` / `competitorSource`
- `missingData` flag in evidence when either side lacks observations

Users should interpret gaps and opportunities in light of incomplete data.

## Copyright

Page comparisons show structural metadata (headings outline, topics, word counts, schema types) — not substantial reproduction of competitor content. Users must create original content aligned with brand strategy.
