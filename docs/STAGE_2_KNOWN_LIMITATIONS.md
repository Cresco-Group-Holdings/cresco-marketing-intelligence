# Stage 2 Known Limitations

Documented limitations at the end of Stage 2 Task 2.20. These are intentional scope boundaries or known gaps, not necessarily bugs.

## Product scope

| Limitation | Status | Notes |
|------------|--------|-------|
| Social inbox | Not on `main` | Unified comment/DM inbox not implemented |
| Video studio | Not on `main` | Video creation/editing workflow not implemented |
| Notifications | Not merged | On separate PR branch |
| Team ops | Not merged | On separate PR branch |
| Reporting dashboards | Not merged | On separate PR branch |
| Native platform scheduling | Not supported | Platform scheduling uses internal scheduler only |
| Multi-account thread publishing | Partial | X threads supported; limited on other providers |

## OAuth and connections

- **`bootstrap.ts` registers mock adapters only** — production OAuth not wired on `main`
- Connector catalogue may show platforms as available in UI before production adapters are registered
- Account capability detection depends on granted OAuth scopes; missing scopes limit features
- Token refresh handled per-provider; some providers require periodic re-auth

## Publishing

- Publishing scheduler added in Task 2.20; requires cron configuration with `PUBLISHING_WORKER_TOKEN`
- Scheduler processes up to `PUBLISHING_SCHEDULER_BATCH` schedules per run (default 50)
- Worker drains up to `PUBLISHING_WORKER_BATCH` jobs per run (default 10)
- TikTok direct publish may require manual fallback when app is not approved
- YouTube implementation targets Shorts (vertical video ≤ 180s)
- LinkedIn document posts support PDF only
- Instagram container polling has bounded retry (12 attempts)
- No cross-region publishing failover

## Analytics

- Analytics sync runs every 6 hours by default (`SOCIAL_ANALYTICS_SYNC_INTERVAL_MINUTES=360`)
- Historical backfill limited to configured window (default 90 days)
- Some provider metrics marked unavailable when API does not expose them
- No real-time analytics; data freshness depends on sync cadence
- Platform-published posts attributed via publishing job records; externally published posts may lack content linkage

## AI content

- AI-generated content requires explicit human approval before publishing
- Mock AI provider used when real providers unconfigured
- No automated fact-checking or compliance review beyond configured rules
- Brand knowledge context may increase generation latency for large knowledge bases

## Security and operations

- In-memory rate limiter (not distributed) — adequate for pilot/low traffic
- Error monitoring uses console abstraction only (no Sentry/Datadog wired)
- No custom metrics dashboard; counters emitted as structured logs
- Emergency kill switches require environment variable change and redeploy
- Credential key rotation is manual (supported but not scheduled)

## Performance

- Dashboard and analytics queries compute in-memory; no caching layer
- Large analytics backfills may approach sync lease timeout
- Publishing worker runs sequentially per batch (no parallel provider calls within one worker invocation)

## Accessibility

- Keyboard navigation improved but Stage 2 UI not fully WCAG 2.1 AA certified
- Colour contrast not audited across all Stage 2 components
- Screen reader testing recommended before public launch

## Data privacy

- No automated data-subject request (DSR) workflow
- Analytics metric retention purge not automated
- See `docs/SOCIAL_DATA_PRIVACY.md` for full privacy posture

## Multi-region

- Single-region deployment assumed
- No cross-region failover for publishing or analytics

## Billing

- No usage-based billing for publishing volume or AI generation in Stage 2

## Related

- `docs/KNOWN_LIMITATIONS.md` — Stage 1 limitations (still applicable where not superseded)
- `docs/STAGE_2_PRODUCTION_READINESS.md` — Release decision
