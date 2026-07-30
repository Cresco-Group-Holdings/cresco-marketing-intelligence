# SEO Issue Rules

## Severity Levels

INFO, LOW, MEDIUM, HIGH, CRITICAL

## Issue Statuses

OPEN, ACKNOWLEDGED, FIXED, IGNORED, FALSE_POSITIVE, REOPENED

## Implemented Rules (v1)

| Rule ID | Severity | Category |
|---------|----------|----------|
| HTTP_4XX | HIGH | http |
| HTTP_5XX | CRITICAL | http |
| REDIRECT_CHAIN | MEDIUM | redirects |
| REDIRECT_LOOP | HIGH | redirects |
| MISSING_TITLE | HIGH | on-page |
| TITLE_TOO_SHORT | LOW | on-page |
| TITLE_TOO_LONG | LOW | on-page |
| MISSING_META_DESCRIPTION | MEDIUM | on-page |
| MISSING_H1 | MEDIUM | on-page |
| MULTIPLE_H1 | LOW | on-page |
| EMPTY_PAGE | MEDIUM | content |
| THIN_CONTENT | LOW | content |
| NON_HTTPS_URL | HIGH | security |
| SLOW_RESPONSE | MEDIUM | performance |
| OVERSIZED_PAGE | LOW | performance |
| MISSING_IMAGE_ALT | LOW | accessibility |
| NOINDEX_IN_SITEMAP | HIGH | indexing |
| CANONICAL_MISMATCH | MEDIUM | canonical |
| CONFLICTING_ROBOTS | MEDIUM | indexing |
| INVALID_STRUCTURED_DATA | LOW | structured-data |
| BROKEN_INTERNAL_LINK | HIGH | links |
| DUPLICATE_CONTENT_HASH | MEDIUM | content |

## Versioning

Rules defined in `SeoIssueDefinition` with `ruleId` + `version`. Each `SeoCrawlIssue` stores `ruleId`, `ruleVersion`, and JSON `evidence`.

## Thresholds

Configurable per rule via `thresholds` JSON on `SeoIssueDefinition`.
