# Stage 2 Security Review

Targeted security review of Stage 2 Social Media AI (Tasks 2.1–2.20).

**Review date:** 2026-07-29

## Summary

| Category | Status | Mitigation |
|----------|--------|------------|
| IDOR / tenant isolation | Mitigated | Organisation/project/brand scoping on all content and social APIs |
| Privilege escalation | Mitigated | RBAC enforced server-side; approval workflow gated |
| OAuth state / PKCE | Mitigated | Random state, TTL, tenant-scoped storage (Stage 1 pattern) |
| Social credential encryption | Implemented | AES-256-GCM via `socialCredentialService` |
| Credential API exposure | Mitigated | Tokens never returned via API; encrypted at rest |
| Worker endpoint auth | Implemented | `PUBLISHING_WORKER_TOKEN` bearer check on scheduler/worker routes |
| Publishing idempotency | Implemented | Unique `idempotencyKey` per schedule/job prevents duplicate posts |
| Capability enforcement | Partial | Enforced at publish enqueue and scheduler; UI may show unavailable actions |
| Provider kill switches | Implemented | Emergency shutdown flags in `src/lib/publishing/config.ts` |
| SSRF via media URLs | Low risk | Publishing uses signed storage URLs with TTL, not user-supplied fetch targets |
| XSS in generated content | Mitigated | React escaping; no `dangerouslySetInnerHTML` in content forms |
| Rate limiting | Partial | In-memory limiter; not distributed across serverless instances |
| Dependency vulnerabilities | Monitored | `npm run audit:deps` in CI + weekly schedule |
| Secret exposure | Mitigated | Secret scan in CI; server-only env vars |
| Logging privacy | Mitigated | Structured redaction; tokens never logged |
| Mock OAuth in production | **Risk** | `bootstrap.ts` registers mock adapters — must not ship to production as-is |

## Tenant isolation

**Controls:**
- All content, schedule, and publishing queries filter `organisationId` (+ `projectId`, `brandId`)
- Publishing job processing verifies schedule tenant matches job tenant
- Social account lookups scoped to brand and organisation
- Analytics sync scoped per account within tenant

**Tests:** publishing service integration tests, tenant isolation in analytics E2E

## Social credential security

**Controls:**
- `ENCRYPTION_KEY` server-only, minimum 32 characters
- Access and refresh tokens encrypted separately via `encryptSecret`
- `socialCredentialService.readTokens` decrypts only in server context
- Disconnect flow deletes credential rows
- Key rotation via `rotateStoredCredentials` with audit trail

**Tests:** `tests/unit/social-credential-encryption.test.ts`, `tests/unit/connector-encryption.test.ts`

## Worker endpoint security

**Controls:**
- `isAuthorisedWorkerRequest` validates `Authorization: Bearer <PUBLISHING_WORKER_TOKEN>`
- Rejects missing, incorrect, or non-bearer tokens
- Returns 403 without leaking token details

**Routes protected:**
- `POST /api/publishing-scheduler/process-due`
- `POST /api/publishing-jobs/[jobId]/process`
- `POST /api/social-analytics-sync/schedule`
- `POST /api/social-analytics-sync/process-due`

**Tests:** `tests/unit/publishing-worker-auth.test.ts`

## Publishing security

**Controls:**
- Only `APPROVED` content can be published or scheduled
- Asset licence expiry checked before enqueue
- `SocialAccountCapability` checked at enqueue and scheduler
- Provider emergency shutdown prevents enqueue and scheduled dispatch
- Durable job state prevents duplicate provider posts on worker retry
- Manual publication requires explicit URL confirmation (TikTok fallback path)

**Residual risk:** Mock adapters in bootstrap mean production OAuth token exchange is untested on `main`.

## Analytics security

**Controls:**
- Analytics sync requires `READ_INSIGHTS` capability
- Sync jobs tenant-scoped with idempotent windows
- Provider errors classified; tokens refreshed server-side only

## AI content security

**Controls:**
- Server-only AI provider keys
- Prompt governance and cost controls (Stage 1 Secure AI Core)
- AI-generated content requires explicit approval before publishing
- Brand context injected server-side; not client-controllable

## Data privacy

See `docs/SOCIAL_DATA_PRIVACY.md` for retention, PII handling, and data-subject considerations.

## Recommendations before production

1. **Replace mock OAuth bootstrap** with production adapter registration gated by environment
2. Wire external error monitoring (Sentry or equivalent)
3. Deploy distributed rate limiting for serverless
4. Complete WCAG accessibility audit for Stage 2 UI
5. Run real-provider sandbox validation per platform before enabling customer accounts
6. Configure `PUBLISHING_WORKER_TOKEN` rotation schedule
7. Verify provider app review status (Meta, TikTok, LinkedIn, Google, X)

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | |
| Security | | | |
