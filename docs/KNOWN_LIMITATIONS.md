# Known Limitations

<<<<<<< HEAD
Documented intentional scope boundaries. These are not bugs.

## Stage 1
=======
Documented limitations across Stage 1 and Stage 2. See `docs/STAGE_2_KNOWN_LIMITATIONS.md` for Stage 2-specific gaps.
>>>>>>> 95eb5ce (feat(stage-2): Task 2.20 production readiness hardening and docs)

## Stage 2 status (Task 2.20)

Stage 2 Social Media AI is **not ready for unrestricted production launch**. Key blockers:
- Mock OAuth adapters only in `src/lib/social/bootstrap.ts` — production OAuth not wired on `main`
- Social inbox and Video Studio not implemented on `main`
- Notifications, team ops, and reporting on separate PR branches not merged to `main`

Publishing scheduler, capability enforcement, provider kill switches, and operational runbooks were added in Task 2.20. See `docs/STAGE_2_PRODUCTION_READINESS.md` for the full audit.

## Product scope (Stage 1 baseline)

| Limitation | Status | Stage 2 plan |
|------------|--------|--------------|
| Content Studio | Implemented (Stage 2) | AI content generation available |
| Content Calendar | Implemented (Stage 2) | Scheduling engine operational |
| Social Media | Partial (Stage 2) | Publishing adapters implemented; OAuth mock only |
| Analytics dashboards | Partial (Stage 2) | Sync and query APIs; dashboards on separate branch |
| AI Agents (user-facing) | Coming soon | Built on Secure AI Core |
| Live connector sync | Partial | Analytics scheduler operational; OAuth mock only |

## Connectors

- Production OAuth adapters not registered on `main` (mock adapters in bootstrap)
- Connector catalogue may display platforms before production wiring is complete
- Analytics sync requires `READ_INSIGHTS` capability and live credentials

## Jobs and background processing

- Publishing scheduler added (Task 2.20) — requires cron with `PUBLISHING_WORKER_TOKEN`
- Analytics scheduler operational — requires cron with `PUBLISHING_WORKER_TOKEN`
- Job processing is sequential per worker batch (no parallel provider calls)

## AI

- AI diagnostics available to OWNER/ADMIN only
- AI Content Studio available; generated content requires approval before publishing
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
- Publishing and analytics counters emitted as structured logs (no metrics dashboard)
- Alerting requires external uptime monitor on `/api/health` and `/api/readiness`

## Multi-region

- Single-region deployment assumed
- No cross-region failover

## Billing

<<<<<<< HEAD
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
=======
- No usage-based billing or subscription management
>>>>>>> 95eb5ce (feat(stage-2): Task 2.20 production readiness hardening and docs)
