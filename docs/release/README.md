# V1 Release Documentation

Stage 18 production release audit pack for Cresco Marketing Intelligence V1.

## Launch decision

**CONDITIONALLY READY** — controlled beta launch approved with documented restrictions.

**Score:** 72/100 (see `RELEASE_SCORE.md`)

## Documents

| Document | Purpose |
|----------|---------|
| [PRODUCTION_RELEASE_AUDIT.md](./PRODUCTION_RELEASE_AUDIT.md) | Master audit and launch decision |
| [V1_SCOPE.md](./V1_SCOPE.md) | Frozen scope and module classification |
| [RELEASE_BLOCKERS.md](./RELEASE_BLOCKERS.md) | Open/closed blockers by severity |
| [RELEASE_SCORE.md](./RELEASE_SCORE.md) | Scored dimensions with evidence |
| [SECURITY_RELEASE_REVIEW.md](./SECURITY_RELEASE_REVIEW.md) | Security sign-off |
| [DATA_MIGRATION_PLAN.md](./DATA_MIGRATION_PLAN.md) | Migration procedure |
| [ROLLBACK_PLAN.md](./ROLLBACK_PLAN.md) | Application and feature rollback |
| [SMOKE_TEST_PLAN.md](./SMOKE_TEST_PLAN.md) | Manual E2E scenarios |
| [INCIDENT_RESPONSE_PLAN.md](./INCIDENT_RESPONSE_PLAN.md) | Incident handling |
| [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) | Honest capability inventory |
| [POST_LAUNCH_BACKLOG.md](./POST_LAUNCH_BACKLOG.md) | Post-V1 engineering backlog |
| [V1_RELEASE_NOTES.md](./V1_RELEASE_NOTES.md) | Customer-facing release notes |

## Related V1 docs

- `docs/V1_PRODUCTION_READINESS.md` — Stages 1–6 readiness (prior audit)
- `docs/V1_BETA_SCOPE.md` — Allowed beta tenants
- `docs/V1_LAUNCH_MONITORING.md` — First 72 hours monitoring
- `docs/V1_SUPPORT_RUNBOOK.md` — Customer support

## Verification (2026-08-05)

```
npm run typecheck          ✅ PASS
npm run test:unit          ✅ 1,315+ passed
npm run test:integration   ✅ 363 passed
npm run validate:migrations ✅ 68 migrations
```

Automated doc presence: `tests/unit/release-audit.test.ts`
