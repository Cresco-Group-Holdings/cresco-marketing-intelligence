# Keyword Import

## Supported CSV Fields

keyword, language, country, volume, cpc, difficulty, position, url, tags

## Flow

1. **Upload** — `POST /api/brands/[brandId]/seo/keywords/import` creates preview
2. **Preview** — validation, rejected rows, column mapping
3. **Confirm** — `PATCH ?importId=` processes accepted rows

## Security

- CSV formula injection neutralised via `sanitizeCsvRow()`
- Idempotency via `idempotencyKey` on `SeoKeywordImport`
- Provider label stored on import job and metrics
- Rejected rows recorded with reason

## Metric Handling

- volume → SEARCH_VOLUME
- cpc → CPC
- difficulty → DIFFICULTY
- position → RANK_POSITION
- url → CURRENTLY_RANKING page mapping

Only values present in CSV are stored. Missing values remain null.
