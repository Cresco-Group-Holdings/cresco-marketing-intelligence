# SEO Competitor Data Policy

## Principles

1. **No substantial copying** — competitor page content is never stored in full
2. **Minimal storage** — excerpts truncated to policy limits; titles and URLs only where sufficient
3. **Public evidence only** — only publicly accessible pages are crawled
4. **Transformative summaries** — AI summaries must be original analysis, not reproduction
5. **No plagiarism instructions** — AI prompts explicitly prohibit copying competitor text
6. **Provenance retained** — source URL and collection date stored on all evidence records
7. **Bounded crawling** — page limits, depth limits, rate limits enforced

## Storage limits

| Data type | Limit |
|-----------|-------|
| Page excerpt | 500 characters (truncated) |
| Max pages per competitor crawl | 50 |
| Max crawl depth | 3 |
| Request delay | 1000ms minimum |

## Implementation

- `src/lib/briefs/competitor-guardrails.ts` — excerpt truncation, plagiarism pattern detection
- `src/lib/competitors/crawl-policy.ts` — SSRF validation, path blocklist
- `src/lib/competitors/constants.ts` — crawl bounds
- `SeoCompetitorEvidence` model — stores evidence type, URL, excerpt, collected date

## AI usage

Competitor content passed to AI is:
- Truncated before inclusion in prompts
- Treated as untrusted input (injection detection applied)
- Used for gap analysis only, not content generation verbatim

## User responsibilities

- Respect competitor `robots.txt` and terms of service
- Use competitor intelligence for strategic analysis, not content duplication
- Review AI-generated briefs before publication
