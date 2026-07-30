# Search Console API Capabilities Audit

> Based on official Google Search Console API documentation as of July 2026.

## APIs used by Cresco

| API | Base URL | Purpose |
|-----|----------|---------|
| **Search Analytics** | `https://www.googleapis.com/webmasters/v3` | Organic search performance (clicks, impressions, CTR, position) |
| **Sites** | `https://www.googleapis.com/webmasters/v3` | List and validate verified properties |
| **Sitemaps** | `https://www.googleapis.com/webmasters/v3` | Read sitemap submission status (read-only) |
| **URL Inspection** | `https://searchconsole.googleapis.com/v1` | Manual URL index status checks |

## OAuth scopes

| Scope | Used by Cresco |
|-------|----------------|
| `https://www.googleapis.com/auth/webmasters.readonly` | Yes — read-only access |
| `https://www.googleapis.com/auth/webmasters` | No — write access not required |

## Quotas

| API | Limit |
|-----|-------|
| Search Analytics | ~1,200 queries per minute per site |
| URL Inspection | ~600/minute, ~2,000/day per site |
| Sites / Sitemaps | Standard API quotas |

Cresco mitigations: bounded date ranges, row pagination (max 25,000/request), delayed-data reconciliation, idempotent imports, no unrestricted URL inspection.

## Data delays

- Search Analytics data is typically **2–3 days behind** real time
- Current-day data is incomplete and must not be treated as final
- Cresco excludes today from incremental sync and reconciles the last 3 days

## Row limits

- Maximum **25,000 rows** per Search Analytics query
- Maximum **16 months** of historical data available
- Queries exceeding row limits are paginated with `startRow`

## Anonymised queries

Google groups low-volume queries into anonymised buckets. Cresco:

- Stores `isAnonymized: true` when query text matches known anonymisation patterns
- Preserves query-level and page-level grains separately
- Does not attempt to de-anonymise grouped data

## Property types

| Type | Format | Example |
|------|--------|---------|
| Domain property | `sc-domain:example.com` | All subdomains and protocols |
| URL-prefix property | `https://example.com/` | Specific protocol + path prefix |

Users must explicitly select a property. Cresco does not auto-select when multiple exist.

## Supported dimensions (query registry only)

- `date`, `query`, `page`, `country`, `device`, `searchAppearance`

## Supported metrics

- `clicks`, `impressions`, `ctr`, `position` (mapped to canonical `avg_position`)

## Limitations

- No automatic sitemap modification
- No large-scale URL inspection (manual only, quota-tracked)
- No AI content generation (Stage 4)
- Sampling/thresholding may affect low-volume queries
