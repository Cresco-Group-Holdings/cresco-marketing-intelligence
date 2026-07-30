# Stage 4 Known Limitations

## Crawler

- **No JavaScript rendering** — SPAs and client-rendered content may be incomplete
- **Regex HTML parser** — complex DOM structures may be mis-parsed
- **DNS rebinding** — hostname validation only; no post-resolve IP check
- **Postgres queue** — not distributed; single-worker processing per run batch
- **`requestConcurrency`** — documented but sequential batch processing in v1
- **Competitor robots fallback** — crawl proceeds if robots.txt fetch fails (bounded)

## AI

- **Shared org daily token limit** — SEO AI shares global `AI_ORGANISATION_DAILY_TOKEN_LIMIT`
- **In-memory rate limiter** — not suitable for multi-instance without Redis
- **No guaranteed accuracy** — all AI output requires human review
- **English-first** — multi-language support varies by module

## Data

- **GSC delay** — 2–3 days behind real time
- **Average position** — not exact rank per query
- **No fabricated metrics** — volume/CPC/difficulty unavailable without licensed provider
- **Rank provider integration** — manual import and GSC supported; third-party providers require configuration

## Quotas (defaults)

| Limit | Value |
|-------|-------|
| Concurrent crawls per org | 3 |
| Crawls per day per org | 20 |
| Max pages per crawl | 10,000 (config max) |
| Tracked keywords per project | 100 (rank tracking default) |
| AI SEO requests per day | 200 |

Override via `SEO_ORG_QUOTA_OVERRIDES` JSON env var.

## Accessibility

- Graph visualisations lack full screen-reader alternatives (table fallback recommended)
- Partial WCAG audit — keyboard navigation works; colour-independent severity badges used
- Reduced motion not yet applied to all animations

## Integrations

- Plan-tier quota enforcement not tied to billing system
- Webhook notifications for rank alerts not implemented (in-app only)
- No Prometheus/Datadog exporter (in-process counters via `/api/seo/metrics`)
