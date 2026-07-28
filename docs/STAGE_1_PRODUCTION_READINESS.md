# Stage 1 Production Readiness

This document audits Tasks 1.1–1.9 and records the production-readiness posture before Social Media AI (Stage 2).

## Launch recommendation

**Recommendation:** Stage 1 is ready for **controlled preview deployment** and final operational sign-off. Production launch should proceed only after environment isolation, backup verification, and OAuth redirect configuration are confirmed for the target Vercel project.

| Area | Status | Notes |
|------|--------|-------|
| Architecture | Ready | Modular services, provider abstractions, tenant-scoped data models |
| Authentication | Ready | Supabase Auth, HttpOnly cookies, rate limits, security audit log |
| Tenant isolation | Ready | Organisation/project/brand scoping enforced server-side |
| RBAC | Ready | Permission matrix documented in `docs/RBAC.md` |
| Database schema | Ready | Migrations through Task 1.8, Prisma validation in CI |
| Invitation security | Ready | Hashed tokens, expiry, revocation |
| Asset security | Ready | MIME validation, SVG sanitisation, malware scan hook, signed URLs |
| AI security | Ready | Server-only keys, redaction, cost controls, diagnostics gating |
| Connector credential security | Ready | AES-256-GCM at rest, OAuth state, no secret API responses |
| Accessibility | Partial | Keyboard nav and focus rings improved; full WCAG audit recommended pre-launch |
| Test coverage | Ready | 140+ unit/integration tests, focused E2E, CI gates |
| Documentation | Ready | Architecture, security, operations, and release docs |
| Deployment readiness | Ready with ops checklist | Vercel-compatible; manual migration deploy required |

## Task audit summary

### Task 1.1–1.2 — Platform foundation
- Workspace model (organisation → project → brand)
- RBAC permissions and owner protection
- Environment validation, structured logging, CSP headers

### Task 1.3 — Authentication
- Supabase Auth, session middleware, OAuth callback
- Rate limiting, CSRF on mutating auth routes, account recovery

### Task 1.4 — Onboarding
- Eight-step wizard, Cresco template, workspace preference persistence

### Task 1.5 — Brand Knowledge Base
- Structured knowledge models, readiness scoring, import/export

### Task 1.6 — Brand Asset Library
- Secure uploads, storage abstraction, governance metadata

### Task 1.7 — Secure AI Core
- Provider abstraction, prompt governance, usage tracking, diagnostics gating

### Task 1.8 — Connector framework
- Registry, encrypted credentials, OAuth lifecycle, sync engine, job abstraction

### Task 1.9 — Foundation dashboard
- Deterministic readiness, rule-based next actions, real audit activity, no fake metrics

## Environment isolation

See `docs/ENVIRONMENT.md` and the Environment Isolation section below.

| Environment | Database | Supabase | OAuth redirects | Encryption key | Storage |
|-------------|----------|----------|-----------------|----------------|---------|
| Development | Local PostgreSQL | Dev project | `http://localhost:3000` | Local `.env` key | Local/memory |
| Preview | Preview DB (required) | Preview project | `https://<preview>.vercel.app` | Preview key | Preview bucket |
| Production | Production DB | Production project | `https://<prod-domain>` | Production key | Production bucket |

**Production-only restrictions:**
- `ALLOW_TEST_AUTH` must be `false` or unset
- `ALLOW_AI_DIAGNOSTICS` should be `false` unless explicitly required
- `ALLOW_DEV_SEED` must not be enabled
- Development seed blocked in production by default

## Database governance

| Control | Implementation |
|---------|----------------|
| Migration workflow | `prisma/migrations/*` via `npm run db:migrate` (dev) |
| Production deploy | `npm run db:migrate:deploy` |
| Validation | `npm run validate:migrations`, `npm run validate:prisma` in CI |
| Rollback | Documented in `docs/ROLLBACK.md` — forward-fix preferred |
| Seed restrictions | `prisma/seed.ts` blocks production without `ALLOW_DEV_SEED=true` |
| Backup policy | Documented in `docs/BACKUP_RECOVERY.md` |
| Connection pooling | Use provider pooler URL for `DATABASE_URL` in serverless (e.g. Supabase pooler) |
| Direct URL | `DIRECT_URL` for migrations only |

## Observability

| Capability | Location |
|------------|----------|
| Structured logs | `src/lib/logging/index.ts` |
| Request IDs | `src/lib/api/response.ts`, `x-request-id` header |
| Error monitoring abstraction | `src/lib/observability/error-monitor.ts` |
| Liveness | `GET /api/health` |
| Readiness | `GET /api/readiness` (DB, env, job system, diagnostics policy) |
| Alerting guidance | `docs/OBSERVABILITY.md` |

Public endpoints return safe messages only — no stack traces or secrets.

## CI/CD

Pull Request CI (`.github/workflows/pull-request.yml`):
- lint, typecheck, unit tests, integration tests, build
- dependency audit, secret scan
- Prisma validate, migration validate
- Concurrency cancellation for superseded runs

Scheduled:
- Playwright E2E (weekly + manual)
- Security audit (weekly)
- Dependency review (weekly)

## Performance notes

- Dashboard uses server-side aggregation via `foundationDashboardService` (single service call)
- Brand knowledge readiness computed in-memory from snapshot
- No N+1 in dashboard service — parallel `Promise.all` for data fetches
- Marketing asset and connector lists paginated at API level where applicable
- Tenant-aware data — no shared cache keys across organisations
- Image optimisation via Next.js + Sharp for marketing assets

## Accessibility notes

- Sidebar mobile menu with keyboard-focusable controls
- `aria-current`, `aria-label`, and `sr-only` text on navigation
- Form labels on auth and settings pages
- Stage 2 modules labelled “Soon” in navigation
- Full colour-contrast audit recommended before public launch

## Known gaps before Stage 2

Documented in `docs/KNOWN_LIMITATIONS.md`:
- Connector adapters not yet live (catalogue shows unavailable state)
- Content Studio, Calendar, Social, Analytics, AI Agents are Stage 2
- Persistent job queue not deployed (abstraction only)
- External error monitoring service not wired (console abstraction in place)

## Final validation scenario

The Stage 1 foundation scenario is covered by:
- Unit/integration tests for tenant isolation, RBAC, uploads, AI, connectors, dashboard
- `tests/e2e/stage-1-foundation.spec.ts` for authenticated smoke validation
- Manual QA checklist in `docs/STAGE_1_RELEASE_CHECKLIST.md`

## Sign-off

| Check | Required |
|-------|----------|
| All PR CI jobs pass | Yes |
| `npm run build` passes | Yes |
| Migrations validate | Yes |
| Tenant-isolation tests pass | Yes |
| Auth/RBAC/upload/AI/connector tests pass | Yes |
| No unresolved critical/high security issues | Yes |
| Documentation complete | Yes |
| Production deploy authorised separately | Yes — not automatic |
