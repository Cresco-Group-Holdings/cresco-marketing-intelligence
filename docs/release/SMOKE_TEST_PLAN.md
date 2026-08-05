# Smoke Test Plan

**Audit date:** 2026-08-05  
**Execution:** Manual pre-launch + post-deploy  
**Automation:** `tests/e2e/*.spec.ts` (9 files; CI via `run-e2e` label)

## Pre-deploy smoke (staging)

Run against staging environment before promoting to production.

### Platform

| # | Step | Expected | Automated |
|---|------|----------|-----------|
| 1 | `GET /api/health` | 200 OK | — |
| 2 | `GET /api/readiness` | 200; database connected | — |
| 3 | Load `/login` | Login form renders | `tests/e2e/auth.spec.ts` |
| 4 | Register new account | Success or verification email | `tests/e2e/auth.spec.ts` |
| 5 | Login | Redirect to dashboard or onboarding | `tests/e2e/auth.spec.ts` |
| 6 | Complete onboarding | Reach dashboard | `tests/e2e/onboarding.spec.ts` |

### Workspace

| # | Step | Expected |
|---|------|----------|
| 7 | Create/select organisation | Context set |
| 8 | Create project and brand | Brand appears in selector |
| 9 | Navigate all primary nav items | No blank pages (except Coming Soon) |

### Content workflow

| # | Step | Expected | Automated |
|---|------|----------|-----------|
| 10 | Create content item | Draft saved | — |
| 11 | Submit for review | Status IN_REVIEW; notification to approver | — |
| 12 | Approve content | Status APPROVED | — |
| 13 | Schedule content | Schedule created | — |

### Integrations and publishing

| # | Step | Expected | Automated |
|---|------|----------|-----------|
| 14 | Connect mock provider | Connection CONNECTED | `tests/e2e/integrations-platform.spec.ts` |
| 15 | Create publication | Validation passes | `tests/e2e/publishing-platform.spec.ts` |
| 16 | Execute publication (mock) | Success status | — |

### CRM and leads

| # | Step | Expected |
|---|------|----------|
| 17 | View CRM leads list | Data loads or empty state |
| 18 | Qualify a lead | Status updates; notification emitted |

### Notifications

| # | Step | Expected | Automated |
|---|------|----------|-----------|
| 19 | Open `/notifications` | Inbox loads with sections | `tests/e2e/collaboration-platform.spec.ts` |
| 20 | Mark notification read | Unread count decreases | — |

### Analytics

| # | Step | Expected |
|---|------|----------|
| 21 | Open `/analytics` | Dashboard loads or "connect data" state |
| 22 | View executive dashboard | Metrics or "Unavailable" (not zero) |

### Settings and security

| # | Step | Expected |
|---|------|----------|
| 23 | Invite team member | Invitation created |
| 24 | Change member role | Permission enforced |
| 25 | Sign out and sign back in | Session restored |

### Tenant isolation (critical)

| # | Step | Expected | Automated |
|---|------|----------|-----------|
| 26 | Access other org's brandId in API | 403/404 | `tests/unit/v1-tenant-isolation.test.ts` |
| 27 | Cross-tenant mention in comment | Rejected | `tests/unit/collaboration-platform.test.ts` |

## Post-deploy smoke (production)

Execute within 30 minutes of production deploy:

1. Health + readiness checks (steps 1–2)
2. Login with known test account (steps 3–5)
3. Dashboard loads (step 9 — Overview only)
4. Create and delete test content item (steps 10, cleanup)
5. Check notification bell renders
6. Verify no 5xx spike in logs

## Automated test commands

```bash
# Full unit + integration (CI gate)
npm run test:unit        # 1,315 tests
npm run test:integration # 363 tests

# E2E (requires running app + label in CI)
npx playwright test tests/e2e/

# V1 safety
npx vitest run tests/unit/v1-tenant-isolation.test.ts
npx vitest run tests/unit/v1-production-readiness.test.ts
```

## Pass criteria

- All pre-deploy steps 1–27 pass on staging
- Post-deploy steps 1–6 pass on production
- Zero cross-tenant isolation failures
- No BLK items in `RELEASE_BLOCKERS.md`

## Failure response

| Failure type | Action |
|--------------|--------|
| Health/readiness | Do not promote; check env vars and DB |
| Auth failure | BLK — halt deploy |
| Cross-tenant access | BLK — halt deploy; incident response |
| Single module failure | Feature flag shutdown; assess rollback |
| E2E flake | Re-run once; if persistent, file P1 blocker |
