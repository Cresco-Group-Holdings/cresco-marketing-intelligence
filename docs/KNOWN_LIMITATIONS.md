# Known Limitations — Stage 1

Documented limitations at the end of Stage 1 foundation. These are intentional scope boundaries, not bugs.

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
