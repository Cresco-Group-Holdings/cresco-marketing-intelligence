# Known Limitations

Documented intentional scope boundaries. These are not bugs.

## Stage 1

## Product scope

| Limitation | Status | Stage 2 plan |
|------------|--------|--------------|
| Content Studio | Coming soon | Content generation workflows |
| Content Calendar | Coming soon | Scheduling and publishing |
| Social Media | Coming soon | Social integrations and posting |
| Analytics dashboards | Coming soon | Requires live connector data |
| AI Agents (user-facing) | Coming soon | Built on Secure AI Core |
| Live connector sync | Not available | Provider adapters per platform |

## Connectors

- Connector catalogue displays all platforms; most are `COMING_SOON`
- Connect buttons disabled until adapter is implemented and marked `AVAILABLE`
- No live Instagram, TikTok, Meta, or Google data sync in Stage 1

## Jobs and background processing

- Job provider abstraction exists; production persistent queue not deployed
- Sync engine runs inline in request context for tests/dev
- Scheduled sync requires Stage 2 worker infrastructure

## AI

- AI diagnostics available to OWNER/ADMIN only
- No user-facing content generators
- Mock provider used when real providers unconfigured

## Performance

- In-memory rate limiter (not distributed) — adequate for preview/low traffic
- Dashboard recomputes readiness on each page load (no caching layer)
- Large brand knowledge bases may increase dashboard load time

## Accessibility

- Keyboard navigation improved but not fully WCAG 2.1 AA certified
- Colour contrast not audited across all components
- Screen reader testing recommended before public launch

## Observability

- Error monitoring uses console abstraction only (no Sentry/Datadog wired)
- No custom metrics dashboard
- Alerting requires external uptime monitor on `/api/health` and `/api/readiness`

## Multi-region

- Single-region deployment assumed
- No cross-region failover

## Billing

- No usage-based billing or subscription management in Stage 1

## Marketing data warehouse (Task 3.1)

Documented limitations at the end of Task 3.1 warehouse foundation.

### Ingest and connectors

| Limitation | Status | Plan |
| --- | --- | --- |
| Live GA4 sync | Not available | Connector adapter; Task 3.2+ |
| Live Google Ads sync | Not available | Connector adapter; Task 3.2+ |
| Live Google Search Console sync | Not available | Connector adapter; Task 3.2+ |
| Connector → warehouse write path | Not wired | Reuse sync engine; Task 3.2+ |
| Provider normaliser | Stub only | Per-provider mapping; Task 3.2+ |
| Social ETL into warehouse | Read-bridge only | No migration of existing `SocialPostMetric` rows |
| Webhook ingest | Schema only | Task 3.2+ |

### Data and query

| Limitation | Status | Plan |
| --- | --- | --- |
| Daily aggregates only | By design | Hourly/real-time in later tasks |
| Probabilistic identity resolution | Not available | Schema only; explicit links in 3.1 |
| Cross-source attribution | Out of scope | Future growth intelligence task |
| JSON dimension indexing | Not available | Tenant + date keys only |
| Social metric registry unification | Parallel registries | `SocialMetricDefinition` → `MarketingMetricDefinition` in 3.2 |

### Operations

| Limitation | Status | Plan |
| --- | --- | --- |
| Warehouse scheduler cron | Not deployed | Health API only; cron in 3.2 |
| Freshness alerting | Not available | Health records only; notifications in 3.2 |
| Automated FX rate feeds | Not available | Manual/test rates only |
| AI-assisted import mapping | Not available | Manual column mapping in 3.1 |
| Raw payload encryption at rest | Not implemented | Policy: no secrets in raw layer |

### Active paths in 3.1

- Manual CSV/TSV/JSON/XLSX import (`docs/MANUAL_IMPORT.md`)
- First-party event ingestion
- Social bridge read adapter (`SOCIAL_BRIDGE` provider)
- Stub normaliser for test fixtures
- Operations dashboard, health API, quality framework (schema + services)

See `docs/MARKETING_DATA_WAREHOUSE.md` and `docs/TASK_3_1_PREFLIGHT.md` for architecture decisions and deferred debt.
