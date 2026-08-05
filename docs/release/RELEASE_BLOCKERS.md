# Release Blockers

**Audit date:** 2026-08-05  
**Launch decision:** CONDITIONALLY READY (see `RELEASE_SCORE.md`)

## Severity classes

| Class | Definition | Launch impact |
|-------|------------|---------------|
| **BLK** | Launch blocker — must be resolved before any customer launch | Blocks READY |
| **P0** | Critical — security, data loss, auth, billing corruption | Blocks READY |
| **P1** | High — major journey broken, significant misrepresentation | Blocks READY unless documented with control |
| **P2** | Medium — degraded experience, workaround exists | CONDITIONALLY READY acceptable |
| **P3** | Backlog — post-launch improvement | No launch impact |

## Open items

| ID | Severity | Area | Description | Status | Owner | Mitigation |
|----|----------|------|-------------|--------|-------|------------|
| RB-001 | P1 | Billing | No SaaS subscription billing UI or Stripe Checkout for platform plans | **OPEN** | Product | V1 limited to beta tenants; manual provisioning |
| RB-002 | P1 | E2E | Full V1 user journey not automated in default CI | **OPEN** | Engineering | Manual smoke per `SMOKE_TEST_PLAN.md`; Playwright on `run-e2e` label |
| RB-003 | P2 | Routes | `/calendar` and `/ai-agents` are placeholder empty states | **ACCEPTED** | Product | Nav shows "Soon" badge; not marketed as complete |
| RB-004 | P2 | Providers | Meta Ads requires app review for non-owned ad accounts | **ACCEPTED** | Partnerships | Document in onboarding; use owned accounts in beta |
| RB-005 | P2 | Legal | Privacy/Terms pages exist (`/privacy`, `/terms`) but require legal counsel review | **OPEN** | Legal | Do not launch public marketing until sign-off |
| RB-006 | P2 | Accessibility | No full WCAG 2.2 AA audit completed | **OPEN** | Engineering | Keyboard nav and labels verified spot-check; full audit post-V1 |
| RB-007 | P2 | Quotas | Plan-tier enforcement partial (email daily quotas only) | **ACCEPTED** | Engineering | Manual tenant configuration per `KNOWN_LIMITATIONS.md` |
| RB-008 | P3 | Performance | Typecheck/build require `NODE_OPTIONS=--max-old-space-size=8192` | **ACCEPTED** | Engineering | CI configured; documented in ops runbook |

## Closed items (this audit)

| ID | Severity | Area | Resolution |
|----|----------|------|------------|
| RB-C01 | BLK | Tests | 5 failing tests (provider capabilities, publication mock, auth signup, env classification) — **FIXED** 2026-08-05 |
| RB-C02 | P0 | Config | Empty `SUPABASE_ANON_KEY` in `.env` overrode valid public key — **FIXED** in `readSupabaseServerConfigFromProcessEnv` |
| RB-C03 | BLK | Build | `npm run typecheck` — **PASS** |
| RB-C04 | BLK | Build | `npm run build` — **PASS** (prior audit) |
| RB-C05 | BLK | Migrations | 68 migrations validate; schema valid — **PASS** |
| RB-C06 | P0 | Security | Cross-tenant isolation — **PASS** (`tests/unit/v1-tenant-isolation.test.ts`) |
| RB-C07 | P0 | Security | No autonomous commercial actions — **PASS** (`tests/unit/v1-production-readiness.test.ts`) |

## Launch blocker checklist (BLK gate)

| Check | Result |
|-------|--------|
| Authentication failure (signup/login broken) | ✅ PASS — 363 integration tests including auth |
| Onboarding loop | ✅ PASS — onboarding unit + integration + e2e specs |
| Cross-tenant data access | ✅ PASS — tenant isolation test suite |
| Billing corruption | ⚠️ N/A — no SaaS billing in V1 |
| Credential leakage | ✅ PASS — secret scan in CI; tokens encrypted |
| Data loss | ✅ PASS — additive migrations only |
| Broken migrations | ✅ PASS — `validate:migrations` (68 migrations) |
| Unhandled critical provider action | ✅ PASS — gateway error classification + audit |
| Unrecoverable background jobs | ✅ PASS — retry/dead-letter on sync and publish |
| Production build failure | ✅ PASS |

## Decision impact

**No BLK or P0 items remain open.** P1 items RB-001 and RB-002 restrict launch to **controlled beta** (CONDITIONALLY READY), not unrestricted public self-serve.
