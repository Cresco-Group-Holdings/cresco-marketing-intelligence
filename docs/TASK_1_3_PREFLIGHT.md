# Task 1.3 Pre-flight Audit

Date: 2026-07-28  
Branch: `cursor/auth-sessions-e94c`

## Scope

Production authentication, sessions, and account security on top of the workspace architecture from Tasks 1.1 and 1.2.

## Existing foundation (reviewed)

| Component | Path | Status |
| --- | --- | --- |
| Server Supabase client | `src/lib/auth/supabase-server.ts` | Working — `@supabase/ssr` with cookie adapter |
| Browser client | `src/lib/auth/supabase-browser.ts` | Defined — wired into auth UI in Task 1.3 |
| Service role client | `src/lib/auth/supabase-service.ts` | Defined — used for session admin operations |
| Middleware | `src/middleware.ts` | Partial — session refresh, protected-route redirect; extended in Task 1.3 |
| OAuth callback | `src/app/auth/callback/route.ts` | Minimal — hardened with error handling, provisioning, safe redirects |
| Profile provisioning | `src/lib/auth/provisioning.ts` | Fixed — idempotent create; preserves user-edited fields on update |
| API auth | `src/lib/api/handler.ts` | Working — `resolveApiUser()` + `withApiHandler()` |
| Route rules | `src/lib/auth/routes.ts` | Extended — new public/auth routes |
| Safe redirects | `src/lib/security/redirects.ts` | Working |
| Rate limiting | `src/lib/security/rate-limit.ts` | Applied to auth endpoints in Task 1.3 |
| Environment validation | `src/lib/environment/index.ts` | Working |
| Tenant guards | `src/lib/tenancy/guards.ts` | Working — membership and archived-org checks |
| Onboarding redirect | `src/components/onboarding/onboarding-redirect.tsx` | Client-side — complemented by server-side post-auth resolver |

## Prerequisites fixed in Task 1.3

1. **Profile provisioning** — `ensureUserProfile()` no longer overwrites `displayName`, `firstName`, or `lastName` on repeat logins; only syncs `email`.
2. **Auth routes** — `/verify-email`, `/reset-password`, `/auth/error` added to public route sets.
3. **Middleware** — `ALLOW_TEST_AUTH` bypass aligned with API handler; auth-route redirects use post-auth destination resolver.
4. **Callback route** — server-side code exchange, provisioning, audit events, and safe redirect handling.
5. **Security audit log** — `SecurityAuditLog` model for auth events that occur outside organisation context.

## Out of scope (confirmed)

- Social publishing integrations
- AI generation
- Analytics ingestion
- Billing and CRM
- Microsoft OAuth (extension point only)
- Avatar file upload

## Acceptance mapping

| Requirement | Implementation |
| --- | --- |
| Email/password signup & login | Auth API routes + UI forms |
| Email verification | `/verify-email` + resend endpoint |
| Logout | API route + user menu |
| Forgot/reset password | API routes + UI pages |
| Password change | Security settings with reauthentication |
| Google OAuth | Server-initiated OAuth + callback |
| Session refresh | Middleware `getUser()` cookie refresh |
| Expired session handling | Middleware redirect to `/login` with return URL |
| Account settings | `/settings/account`, `/settings/security`, `/settings/sessions` |
| Rate limiting | `enforceAuthRateLimit()` on sensitive endpoints |
| Account enumeration protection | Generic messages on login and password reset |
| No localStorage tokens | Supabase SSR HttpOnly cookies only |
| Tests | Unit, integration, and Playwright coverage |
