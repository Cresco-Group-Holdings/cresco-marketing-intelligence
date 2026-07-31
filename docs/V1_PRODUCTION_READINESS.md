# V1 Production Readiness

Master audit of Stages 1–6 (Platform Foundation through CRM, Email, Automation, Scoring, and Lifecycle Agent) before V1 release.

## Release decision

**V1 READY WITH RESTRICTIONS**

The Cresco Marketing Intelligence platform is production-viable for controlled beta with Cresco internal brands, Grants Intelligence, Capital Cresco Terminal, and limited external pilots. Human-in-the-loop is required for all customer messaging, advertising launches, and AI-proposed material actions. Unrestricted production requires expanded billing plan enforcement and automated E2E V1 scenario coverage.

## Verification summary (2026-07-30)

| Gate | Result | Notes |
|------|--------|-------|
| `npm run lint` | ✅ PASS | 0 errors, 93 warnings |
| `npm run test:unit` | ✅ PASS | 1077 passed, 132 files, ~16s |
| `npm run test:integration` | ✅ PASS | 306 passed, 46 files, ~11s |
| `tests/unit/v1-*.test.ts` | ✅ PASS | 47 passed (tenant isolation + production safety) |
| `npx prisma validate` | ✅ PASS | Schema valid |
| `npm run validate:migrations` | ✅ PASS | 59 migrations |
| `npm run typecheck` | ✅ PASS | 0 errors (requires `NODE_OPTIONS=--max-old-space-size=8192`) |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run build` | ✅ PASS | Production build succeeds (~5.5 min) |

**Total automated tests:** 1383 passed across unit and integration suites (47 v1-specific tests included in unit count).

## Stage summary

| Stage | Scope | Decision | Key restriction |
|-------|-------|----------|-----------------|
| 1 | Platform foundation | Ready | Full WCAG audit recommended |
| 2 | Social media AI | Ready with restrictions | Optional real-provider sandbox validation |
| 3 | Marketing analytics | Ready with restrictions | Provider coverage, seasonal anomaly gaps |
| 4 | AI SEO engine | Ready with restrictions | No JS rendering; plan-tier quotas partial |
| 5 | AI advertising | Ready with restrictions | App review; no autonomous launch/spend |
| 6 | CRM & revenue ops | Ready with restrictions | Partial billing enforcement; E2E not fully automated |

## Why V1 READY WITH RESTRICTIONS (not V1 READY)

| Factor | Assessment |
|--------|------------|
| 1383 automated tests pass | Strong regression coverage across all stages |
| Tenant isolation tested | Unit + integration tests per stage; consolidated in `v1-tenant-isolation.test.ts` |
| Human-in-the-loop | All customer messaging, advertising, and AI material actions require approval |
| Billing plan enforcement | Partial — email daily quotas only; SEO/ad/feature quotas not tied to billing |
| Provider app review | Meta non-owned accounts, some ad/email providers require review |
| E2E V1 scenario | Documented in `V1_RELEASE_CHECKLIST.md`; not fully automated |

## Why not V1 NOT READY

- No unresolved critical security or tenant-isolation vulnerabilities
- No autonomous spend, send, or publish paths in production code
- Core business workflows (CRM, forms, pipeline, email, automation, scoring, lifecycle) are implemented and tested
- Database schema and migrations are validated

## Human-in-the-loop guarantees

| Domain | Autonomous action blocked |
|--------|---------------------------|
| Email campaigns | Launch requires approval; suppression cannot be bypassed |
| Marketing automation | High-risk actions (webhooks) require approval; consent gates on send |
| Advertising | 8 launch approval gates; no budget increase without approval |
| Social publishing | Scheduled publish with approval workflow |
| SEO content | No auto-publish; brief and content require human action |
| Lifecycle agent | No auto-send, price change, deal-won, or stage change |
| Lead scoring | AI explains only; `modifiesScore: false` |
| AI analyst | Proposes actions; no autonomous execution |

## Acceptance criteria status

| Criterion | Status |
|-----------|--------|
| Multi-tenant isolation | ✅ Tested across Stages 1–6 |
| RBAC enforced server-side | ✅ Permission matrix in `docs/RBAC.md` |
| OAuth credentials encrypted | ✅ AES-256-GCM |
| AI governance (redaction, cost limits) | ✅ `AIRequestService` |
| Evidence-grounded AI outputs | ✅ Analyst, SEO, advertising, lifecycle agents |
| Missing data shows Unavailable not zero | ✅ Executive dashboard, analyst |
| Production build passes | ✅ Verified with increased heap |
| Typecheck passes | ✅ Verified with increased heap |
| Release documentation complete | ✅ This document set |
| Incident/rollback/runbook coverage | ✅ V1 ops docs |

## Beta scope

See `docs/V1_BETA_SCOPE.md`. In summary:

- Cresco internal operations
- Grants Intelligence product
- Capital Cresco Terminal
- Limited external pilots with signed beta agreement

## Blockers for unrestricted production

1. Complete automated E2E V1 scenario (or sign off manual run)
2. Expand billing plan enforcement beyond email quotas
3. Provider app review for Meta non-owned accounts and selected ad/email providers
4. Full WCAG accessibility audit

## Related documents

| Document | Purpose |
|----------|---------|
| `STAGE_6_PRODUCTION_READINESS.md` | Stage 6 module audit |
| `V1_TENANT_ISOLATION_REVIEW.md` | Cross-tenant boundary audit |
| `V1_PRIVACY_REVIEW.md` | Consent, suppression, deletion, DSR |
| `V1_AI_SAFETY_REVIEW.md` | AI features across all stages |
| `V1_SECURITY_REVIEW.md` | Auth, OAuth, IDOR, XSS, rate limits |
| `V1_DATA_ACCURACY_REVIEW.md` | Metrics formulas and limitations |
| `V1_KNOWN_LIMITATIONS.md` | Feature and provider restrictions |
| `V1_BETA_SCOPE.md` | Allowed tenants and roles |
| `V1_RELEASE_CHECKLIST.md` | Pre-launch checklist |
| `V1_ROLLBACK_PLAN.md` | Rollback procedures |
| `V1_INCIDENT_RESPONSE.md` | Incident severity and response |
| `V1_OPERATIONS_RUNBOOK.md` | Daily/weekly operations |
| `V1_SUPPORT_RUNBOOK.md` | Customer support procedures |
| `V1_PROVIDER_MATRIX.md` | Provider capability matrix |
| `V1_DATA_RETENTION.md` | Retention policies |
| `V1_BACKUP_RECOVERY.md` | Backup and PITR |
| `V1_LAUNCH_MONITORING.md` | Launch monitoring plan |
| `V1_POST_LAUNCH_BACKLOG.md` | Post-launch engineering backlog |
