# On-Page SEO Rules

Deterministic checks run before AI semantic review.

## Technical checks

| Rule ID | Check |
|---------|-------|
| `HTTP_4XX` / `HTTP_5XX` | HTTP status codes |
| `NOINDEX` | Indexability (robots noindex) |
| `CANONICAL_MISMATCH` | Canonical URL vs crawled URL |
| `MISSING_TITLE` / `TITLE_TOO_SHORT` / `TITLE_TOO_LONG` | Title tag |
| `MISSING_META_DESCRIPTION` | Meta description |
| `MISSING_H1` / `MULTIPLE_H1` | Heading structure |
| `EMPTY_PAGE` / `THIN_CONTENT` | Content length |
| `MISSING_IMAGE_ALT` | Image alt text |
| `BROKEN_INTERNAL_LINK` / `BROKEN_LINK` | Link health |
| `INVALID_STRUCTURED_DATA` | JSON-LD validity |
| `NON_HTTPS_URL` | HTTPS |
| `MISSING_VIEWPORT` | Mobile viewport meta |
| `DUPLICATE_CONTENT_HASH` | Duplicate content signals |
| `DUPLICATE_TITLE` / `DUPLICATE_DESCRIPTION` | Metadata duplication |
| `EMPTY_SECTION` | Empty draft sections |

## Keyword rules

- `KEYWORD_ABSENT` — target not present
- `KEYWORD_NOT_IN_HEADINGS` — absent from title/H1
- `KEYWORD_STUFFING` — density > 3% (blocking over-optimisation)
- `KEYWORD_DENSITY_HIGH` — elevated but below stuffing threshold
- `CONFLICTING_TARGET_PAGE` — cannibalisation signal

## Evidence requirement

Every finding MUST include at least one evidence reference:

```json
{ "source": "crawl", "key": "titleLength", "value": 12 }
```

## Recommendation mapping

Technical rules map to recommendation types (e.g. `MISSING_TITLE` → `IMPROVE_TITLE`). See `src/lib/on-page/constants.ts`.

## Stale snapshot

Snapshots older than 14 days trigger a warning. Re-crawl recommended.
