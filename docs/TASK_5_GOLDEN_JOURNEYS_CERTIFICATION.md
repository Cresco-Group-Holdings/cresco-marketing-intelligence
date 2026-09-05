# Task 5 — Golden Customer Journeys A–F Certification

## Harness

| Item | Value |
| --- | --- |
| Harness version | `task-5.0.0` |
| Integration suite | `vitest.golden.config.ts` → `tests/golden/integration/` |
| Browser suite | `tests/e2e/golden-journeys.spec.ts` |
| Certification runner | `npm run test:golden:certify` (3 consecutive runs) |
| Provider mocks | OAuth adapter registry, provider gateway (external boundary only) |
| AI boundary | Deterministic service mocks in content journeys; no browser API keys |
| Stripe boundary | Signature verification unit tests + checkout route contract |
| Worker strategy | `processPublicationPublishingJob` + scheduler discovery (Task 6 pattern) |

## Prerequisites

- `ALLOW_TEST_AUTH=true` + `TEST_AUTH_USER_ID` for browser journeys
- Optional `ANALYTICS_TEST_DATABASE_URL` for database-tier growth intelligence (separate suite)
- Incident #156 resilience fixes included (cherry-picked from Task 1 branch)

## Commands

```bash
npm run test:golden
npm run test:golden:certify
npm run test:e2e -- tests/e2e/golden-journeys.spec.ts
```

## Journey mapping

| Journey | Integration test | Browser test |
| --- | --- | --- |
| A — New Customer → First Insight | `journey-a-new-customer.test.ts` | Onboarding shell (no preview fixtures) |
| B — Content → Publish | `journey-b-content-publish.test.ts` | — |
| C — Attribution | `journey-c-attribution.test.ts` | — |
| D — Operating Loop | `journey-d-operating-loop.test.ts` | Command Centre auth gate |
| E — Billing | `journey-e-billing.test.ts` | Pricing catalogue truth |
| F — Failure Recovery | `journey-f-failure-recovery.test.ts` | Calendar under degraded activation/CC |

## Rules enforced

1. No `/dev/*-preview` fixtures as functional proof in golden browser tests
2. Provider mocks only at external boundary
3. Activation milestones from server state (not client events)
4. Shared report / billing / webhook routes use handler-level auth (Task 2)
5. Incident #156: activation + command-centre failures must not crash calendar

## Report output

`artifacts/golden-journeys/certification-report.json` after `test:golden:certify`
