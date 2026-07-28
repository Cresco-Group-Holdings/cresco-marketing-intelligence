# Stage 1 Security Review

Targeted security review of the Stage 1 foundation (Tasks 1.1–1.9).

## Summary

| Category | Status | Mitigation |
|----------|--------|------------|
| IDOR | Mitigated | Tenant context + organisation scope on all data access |
| Privilege escalation | Mitigated | RBAC enforced server-side; owner protection rules |
| CSRF | Mitigated | Same-origin validation on mutating auth routes |
| XSS | Mitigated | CSP headers, React escaping, SVG sanitisation |
| SSRF | Low risk | No user-controlled outbound URL fetch in Stage 1 |
| Unsafe redirects | Mitigated | `resolveSafeRedirectPath` allowlist |
| File uploads | Mitigated | MIME sniffing, size limits, blocked extensions, scan hook |
| Credential encryption | Implemented | AES-256-GCM for connector tokens |
| Invitation tokens | Mitigated | SHA-256 hashed at rest, expiry, single-use |
| OAuth state | Mitigated | Random state, TTL, PKCE support, tenant-scoped storage |
| Session fixation | Mitigated | Supabase session rotation via SSR cookies |
| Rate limiting | Implemented | Auth rate limits; AI/connector rate-limit abstractions |
| Dependency vulnerabilities | Monitored | `npm run audit:deps` in CI + weekly schedule |
| Secret exposure | Mitigated | Secret scan in CI; server-only env vars |
| Logging privacy | Mitigated | Structured redaction in `src/lib/logging` |

## IDOR and tenant isolation

**Controls:**
- `assertOrganisationScope`, `assertProjectScope` in services
- Brand-scoped APIs resolve brand via `brandService.getById` with organisation check
- Connector, asset, and knowledge queries always filter `organisationId` (+ `projectId`, `brandId`)
- Dashboard API rejects mismatched `organisationId` header

**Tests:** `organisation-access`, `owner-protection`, `connector-service`, `foundation-dashboard-service`

## Privilege escalation

**Controls:**
- `requirePermission` in API handlers
- `canManageMember`, `canChangeRole` prevent non-owners modifying owners
- `ai.diagnostics` restricted to OWNER/ADMIN
- Audit log access restricted by role

**Tests:** `permissions`, `organisation-permissions`

## CSRF

**Controls:**
- Auth mutation routes validate origin (`src/lib/security/csrf.ts`)
- Session cookies are `HttpOnly` via Supabase SSR

## XSS

**Controls:**
- Content Security Policy in middleware
- No `dangerouslySetInnerHTML` in user-facing forms
- SVG sanitiser strips script content from uploaded SVGs

## SSRF extension points

Stage 1 does not fetch arbitrary user-supplied URLs server-side. Future connector adapters must use allowlisted provider endpoints.

## Unsafe redirects

**Controls:**
- `resolveSafeRedirectPath` — internal paths only, blocks open redirects
- OAuth `redirectUri` built from `APP_URL`

**Tests:** `redirects.test.ts`

## File uploads

**Controls:**
- `file-type` MIME detection, Sharp processing
- Extension blocklist for executables/scripts
- Malware scanner hook (pluggable)
- Signed URLs for download; no public bucket listing

**Tests:** `marketing-assets.test.ts`, `marketing-asset-service.test.ts`

## Credential encryption

**Controls:**
- `ENCRYPTION_KEY` server-only, min 32 chars
- Connector access/refresh tokens encrypted separately
- Credentials never returned via API
- Disconnect deletes credential rows

**Tests:** `connector-encryption.test.ts`

## Invitation tokens

**Controls:**
- Tokens hashed before storage (`hashInvitationToken`)
- Expiry and revocation supported
- Generic responses on invalid tokens

## OAuth state

**Controls:**
- `ConnectorOAuthState` with TTL (10 minutes)
- PKCE verifier stored server-side
- State deleted after successful callback
- Scope inspection before marking connected

**Tests:** `connector-oauth.test.ts`, `connector-service.test.ts`

## Session fixation

**Controls:**
- Supabase manages session tokens in HttpOnly cookies
- Middleware refreshes session on each request
- Logout clears session server-side

## Rate limiting

**Controls:**
- `auth-rate-limit.ts` for login/signup/reset
- AI tenant rate limiter abstraction
- Connector sync retry with backoff

**Tests:** `auth-rate-limit.test.ts`, `ai-core.test.ts`

## Dependency and secret scanning

- `npm run audit:deps` in PR CI and weekly schedule
- `npm run audit:secrets` in PR CI and weekly schedule
- Patterns for API keys, private keys, service role assignments

## Logging privacy

- Sensitive key redaction (password, token, secret, api_key, prompt)
- AI requests store digest/preview only, not raw prompts
- Audit events exclude credentials

## Unresolved items

| Item | Severity | Recommendation |
|------|----------|----------------|
| Full WCAG audit | Low | Complete before public marketing launch |
| External WAF | Low | Configure at CDN/Vercel edge for production |
| Persistent rate-limit store | Medium | Replace in-memory limiter with Redis before high traffic |
| Connector SSRF when live | Medium | Allowlist provider endpoints in adapter review |

No **critical** or **high** unresolved issues identified for Stage 1 preview deployment.
