# SEO URL Normalisation

## Version

Current version: `URL_NORMALISATION_VERSION = 1`

## Rules (v1)

1. Lowercase hostname
2. Remove default ports (80, 443)
3. Normalise path (collapse duplicate slashes, decode)
4. Trailing slash removal (except root)
5. Strip URL fragments
6. Strip tracking parameters (`utm_*`, `gclid`, `fbclid`, etc.)
7. Sort remaining query parameters alphabetically

## Equivalence

- `urlsEquivalent()` returns `false` when normalisation is uncertain.
- Pages are never silently merged when equivalence cannot be determined.
- Each unique `normalisedUrl` maps to one `SeoCrawlPage` per site.

## Relative URLs

Resolved via `resolveRelativeUrl(base, relative)` using standard URL resolution.
