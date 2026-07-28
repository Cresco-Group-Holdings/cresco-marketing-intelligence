# Security baseline

Task 1.3 extends the Task 1.1 security posture with production authentication controls.

## Tenant isolation

- Authenticated data is scoped by `organisationId`.
- Project-owned records require `projectId` where appropriate.
- Membership is validated server-side before establishing tenant context.
- Repositories assert organisation and project scope before returning records.
- Client-supplied organisation identifiers are never trusted without membership checks.
- Suspended memberships are denied organisation access.
- Archived organisations are excluded from active workspace resolution.

## Secret management

Server-only secrets:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- AI provider keys
- OAuth client secrets
- database credentials

Public client values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Never expose server-only secrets through `NEXT_PUBLIC_*` variables, API responses, or client bundles.

## Authentication and sessions

- Supabase Auth with `@supabase/ssr` HttpOnly cookies
- No access or refresh tokens in `localStorage`
- Middleware session refresh and expired-session redirect to `/login`
- Server-side OAuth code exchange in `/auth/callback`
- Safe internal redirect allowlist
- Google OAuth enabled; Microsoft OAuth reserved as an extension point

## Auth security controls

- Rate limiting on login, signup, reset, OAuth, and password-change actions
- Generic login and recovery responses
- Password policy enforcement
- Same-origin validation for mutating auth API routes
- Reauthentication before password changes
- `SecurityAuditLog` for auth events outside organisation context

### Security audit events

- `auth.signup`
- `auth.loginSucceeded`
- `auth.loginFailed`
- `auth.logout`
- `auth.emailVerified`
- `auth.passwordResetRequested`
- `auth.passwordChanged`
- `auth.oauthConnected`
- `auth.sessionRevoked`

Never audit passwords, tokens, cookies, or reset URLs.

## Logging restrictions

Structured logging redacts sensitive keys such as:

- passwords
- access and refresh tokens
- cookies
- API keys and OAuth secrets
- confidential prompt content

Do not log full authentication headers, session cookies, or OAuth codes.

## HTTP security controls

- secure response headers via middleware
- Content Security Policy baseline
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- HSTS for production deployments behind HTTPS

## Input and redirect safety

- Zod validates environment configuration and auth payloads
- API routes validate request payloads before service calls
- redirect targets are restricted to safe internal paths
- auth routes and `/auth/*` paths are excluded from post-login redirects

## Rate limiting

A reusable in-memory rate limit abstraction backs auth endpoints. Production deployments should back this with a shared store such as Redis in later tasks.

## Audit events

`AuditLog` records organisation-scoped workspace events. `SecurityAuditLog` records authentication and account security events that occur before or outside organisation context.

## OAuth token storage

Connector OAuth access and refresh tokens are **not** implemented in Task 1.3. Supabase Auth session cookies are managed by Supabase. Future connector tasks will store integration tokens encrypted at rest using server-only credentials and tenant-scoped records.

## Dependency and secret scanning

- `npm run audit:deps` — dependency vulnerability audit
- `npm run audit:secrets` — repository secret pattern scan

Both run in pull request CI.

## Pending security work

The following assumptions remain open for later tasks:

- production WAF / edge rate limiting
- encrypted connector OAuth token storage
- full CSRF token strategy beyond SameSite cookies and origin checks
- secret rotation automation
- Microsoft OAuth enablement
- penetration testing and formal security review
- SOC2 / ISO control mapping
