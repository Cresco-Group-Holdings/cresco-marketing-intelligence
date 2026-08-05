# Security Release Review

**Audit date:** 2026-08-05  
**Reviewer:** Stage 18 release programme (consolidated from Stages 1–7 security reviews)  
**Verdict:** **PASS — no critical or high-severity findings**

Consolidates `docs/V1_SECURITY_REVIEW.md`, `docs/V1_TENANT_ISOLATION_REVIEW.md`, `docs/V1_PRIVACY_REVIEW.md`, and `docs/V1_AI_SAFETY_REVIEW.md`.

## Summary

| Area | Status | Evidence |
|------|--------|----------|
| Authentication | ✅ Pass | Supabase Auth, session rotation, rate limits |
| OAuth token storage | ✅ Pass | AES-256-GCM; never in API responses or logs |
| IDOR / tenant isolation | ✅ Pass | `organisationId` + `brandId` on all queries |
| RBAC | ✅ Pass | Server-side `requirePermission`; owner protection |
| CSRF | ✅ Pass | Origin validation on mutating auth routes |
| XSS | ✅ Pass | CSP, React escaping, SVG sanitisation |
| SSRF | ✅ Mitigated | Crawler allowlists; domain verification |
| Rate limiting | ✅ Pass | Auth, forms, tracking, AI endpoints |
| File uploads | ✅ Pass | MIME validation, size limits |
| Webhook signatures | ✅ Pass | Stripe, email, provider webhooks |
| Secret exposure | ✅ Pass | `audit:secrets` in CI; server-only env vars |
| AI safety | ✅ Pass | No autonomous send/spend/publish |
| Credential leakage | ✅ Pass | Provider credentials encrypted; safe error messages |

## Launch blocker security checks

| BLK check | Result |
|-----------|--------|
| Authentication failure | ✅ PASS — signup/login integration tests |
| Cross-tenant data access | ✅ PASS — `v1-tenant-isolation.test.ts` |
| Credential leakage | ✅ PASS — encryption + redaction in logs |
| Unhandled critical provider action | ✅ PASS — gateway error classification |

## Human-in-the-loop (commercial safety)

Verified by `tests/unit/v1-production-readiness.test.ts`:

| Domain | Autonomous action blocked |
|--------|---------------------------|
| Email | Suppression cannot be bypassed |
| Automation | Webhook actions require approval |
| Advertising | 8 launch approval gates |
| Publishing | Approval workflow required |
| Lifecycle agent | No auto-send, price change, deal-won |
| Lead scoring | `modifiesScore: false` for AI |
| AI analyst | Proposes only; no execution |

## Mandatory security notifications

`CRITICAL_NOTIFICATION_CATEGORIES` includes `SECURITY` — cannot be fully disabled per `src/lib/notifications/constants.ts`.

## Environment security

| Control | Implementation |
|---------|----------------|
| `ALLOW_TEST_AUTH` | Blocked in production |
| `ALLOW_AI_DIAGNOSTICS` | Admin-only; disabled in prod recommended |
| Emergency shutdown | `ADVERTISING_EMERGENCY_SHUTDOWN`, `EMAIL_EMERGENCY_SHUTDOWN`, etc. |
| Encryption key | `ENCRYPTION_KEY` — 32-byte hex required |

## Pre-launch security checklist

- [ ] Verify production `ENCRYPTION_KEY` is unique and rotated from dev
- [ ] Confirm `ALLOW_TEST_AUTH` is unset in production
- [ ] Verify OAuth redirect URIs match production domain only
- [ ] Confirm webhook secrets match provider dashboards
- [ ] Run `npm run audit:secrets` on release branch
- [ ] Verify Supabase RLS policies (if applicable) align with app-layer isolation
- [ ] Confirm CSP headers in production response

## Residual risks (accepted for V1 beta)

| Risk | Severity | Mitigation |
|------|----------|------------|
| No external pen test | P2 | Schedule post-launch pen test |
| Partial SSRF on unverified domains | P2 | Beta: verified domains only |
| AI prompt injection | P2 | Redaction, output schemas, human review |

## Sign-off

**Security release review: PASS for controlled beta launch.**

Unrestricted public launch requires external security assessment (recommended P1 post-V1).
