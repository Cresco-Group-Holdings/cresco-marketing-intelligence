# Task 4 — Launch E2E Harness Certification

Operational guide for Cresco launch-critical browser E2E.

## Audited baseline

- **Main SHA:** `15222583c3917f3def48af92b9d06abef89badf2` (branch base; update after merge)
- **Node:** 22.x
- **Playwright:** 1.62.x (`@playwright/test` ^1.57.0)
- **E2E spec files:** 35 under `tests/e2e/` (including harness specs added in Task 4)

## Environments

| Mode | Command | Database | Test auth | Notes |
| --- | --- | --- | --- | --- |
| Local E2E | `npm run test:e2e:launch` | Local Postgres via `DATABASE_URL` | `CRESCO_E2E_HARNESS=true` + `ALLOW_TEST_AUTH=true` | Uses `npm run dev` |
| CI E2E | `.github/workflows/launch-e2e.yml` | Ephemeral Postgres 16 service `cresco_e2e` | Auto-configured in workflow | Runs migrate deploy + seed before Playwright |
| Staging E2E | `CRESCO_E2E_HARNESS=true ALLOW_TEST_AUTH=true APP_URL=… npm run test:e2e:launch` | Staging test tenant only | Explicit staging opt-in | Never enable on production |

Production deployments must **not** set `CRESCO_E2E_HARNESS` or `ALLOW_TEST_AUTH`.

## Launch-critical command

```bash
npm run test:e2e:launch
```

Runs Playwright project `launch-critical` filtered by `@launch-critical` grep tag.

Preview-only visual journeys use `@preview-visual` and are excluded from release certification.

## Test auth contract

Test authentication requires **all** of:

1. `NODE_ENV !== production`
2. `CRESCO_E2E_HARNESS=true`
3. `ALLOW_TEST_AUTH=true`
4. `TEST_AUTH_USER_ID` set (populated automatically by global setup seed)

Role switching uses the harness-only header `x-cresco-e2e-user-id` (ignored unless the harness flag triplet is active).

## Database strategy

1. `prisma migrate deploy` (global setup + CI)
2. `npm run seed:e2e` → deterministic Tenant A / Tenant B fixture graph
3. Manifest written to `.e2e/tenant-manifest.json` (gitignored)
4. Full truncate reset before each seed (order-independent tests)

## External boundaries

| Boundary | Mechanism |
| --- | --- |
| OAuth providers | `ALLOW_OAUTH_MOCK=true` + canonical mock OAuth adapters |
| AI | `AI_ALLOW_MOCK=true` + `MOCK` provider via orchestration layer |
| Stripe | Public webhook route tested with invalid signature; entitlement flows remain integration-tested |
| Workers | Real routes; unauthenticated calls must fail closed |

Optional live provider checks belong in `@external-live` suite (`npm run test:e2e:external-live`), not the release gate.

## Failure detection gates

Launch-critical specs attach:

- Browser console / uncaught exception gate
- Same-origin unexpected HTTP 5xx gate
- Retry-storm detector for `/api/activation` and `/api/dashboard/command-centre`

## Adding new launch-critical coverage

1. Tag functional journey specs with `@launch-critical`
2. Use `tests/e2e/support/fixtures.ts` for authenticated owner/member contexts
3. Seed additional domain state via factories in `tests/e2e/support/factories/`
4. Do **not** count `@preview-visual` / `/dev/*-preview` as functional proof
5. Verify domain outcomes via API/DB where practical

## CI sequence (launch-e2e workflow)

Install → lint → typecheck → Prisma validate → migration validate → production build → Playwright install → migrate deploy (global setup) → seed → dev app readiness → launch E2E → artifacts on failure.

## Classification

- **Real E2E:** `authenticated-shell-smoke`, `tenant-isolation-e2e`, `incident-156-calendar`, `harness-certification`, `launch-critical` public/auth nav
- **Production-shaped mocked-boundary E2E:** `content-intelligence-production.spec.ts`
- **Preview visual:** `launch-journeys`, `*-visual-qa`, dev preview activation journeys

## Ownership

Engineers add launch-critical specs beside existing harness specs. Keep fixtures deterministic, avoid live provider dependencies in CI, and never weaken production guards to simplify tests.
