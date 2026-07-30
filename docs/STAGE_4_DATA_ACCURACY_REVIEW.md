# Stage 4 Data Accuracy Review

Audit of data handling accuracy across the SEO Engine.

## URL and crawl accuracy

| Area | Status | Notes |
|------|--------|-------|
| URL normalisation | Verified | `url-normalisation.ts` — tracking param stripping, trailing slash |
| Canonical handling | Verified | Stored on snapshots; conflict detection in issue rules |
| Duplicate pages | Verified | Content-hash deduplication in `finaliseRun` |
| Redirect handling | Verified | Redirect chain followed up to `redirectLimit` (5) |
| Robots interpretation | Verified | `robots-parser.ts` — allow/disallow, crawl-delay |
| Sitemap parsing | Verified | URL limits (50k), decompression limits (50 MiB) |

## Keyword and rank accuracy

| Area | Status | Notes |
|------|--------|-------|
| Search Console data | Verified | 2–3 day delay documented; no fabricated metrics |
| Keyword metrics | Verified | Null displayed as unavailable, never zero |
| Rank observations | Verified | Null rank for missing data; idempotent imports |
| Keyword-page mapping | Verified | Relation types: CURRENTLY_RANKING, PRIMARY_TARGET |

## Analysis accuracy

| Area | Status | Notes |
|------|--------|-------|
| Topic clustering | Verified | Deterministic + AI; evidence stored |
| Issue rules | Verified | Versioned definitions; deterministic evaluation |
| Priority scoring | Verified | Multi-factor; documented in topic strategy docs |
| Content decay | Verified | Multi-signal; age alone insufficient |
| Internal-link graph | Verified | Metrics from crawl inventory; sampling for viz |
| Freshness states | Verified | `lastSyncAt`, `measuredAt`, provider metadata |

## Known accuracy limitations

- Regex HTML parser may miss dynamically rendered content (no JS execution)
- GSC average position is not exact rank per query
- Competitor rank data depends on provider availability
- AI suggestions require human review; not guaranteed accurate

## Tests

- `tests/unit/seo-robots-parser.test.ts`
- `tests/unit/keyword-*.test.ts`
- `tests/unit/internal-linking.test.ts`
- `tests/unit/rank-tracking.test.ts`
- `tests/unit/on-page-seo.test.ts`
