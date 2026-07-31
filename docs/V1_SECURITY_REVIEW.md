# V1 Security Review

Consolidated security audit across Stages 1–6 before V1 release.

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication | ✅ Pass | Supabase Auth, HttpOnly cookies, session rotation |
| OAuth token storage | ✅ Pass | AES-256-GCM encryption; tokens not logged |
| IDOR / tenant isolation | ✅ Pass | organisationId + brandId on all data access |
| RBAC | ✅ Pass | Server-side `requirePermission`; owner protection |
| CSRF | ✅ Pass | Origin validation on mutating auth routes |
| XSS | ✅ Pass | CSP, React escaping, SVG sanitisation |
| SSRF | ✅ Mitigated | Crawler allowlists; no arbitrary user URL fetch |
| Rate limiting | ✅ Pass | Auth, forms, tracking, AI rate limits |
| File uploads | ✅ Pass | MIME validation, size limits, scan hook |
| Webhook signatures | ✅ Pass | Stripe, email provider webhooks verified |
| Secret exposure | ✅ Pass | CI secret scan; server-only env vars |
| Stored XSS (CRM/email UI) | ✅ Pass | No `dangerouslySetInnerHTML` in user content |

**No critical or high-severity findings.**

## Authentication

| Control | Implementation |
|---------|----------------|
| Session management | Supabase SSR cookies, HttpOnly |
| Session fixation | Session rotation on auth |
| Password reset | Rate-limited; hashed tokens |
| Signup | Rate-limited per IP |
| Test auth bypass | `ALLOW_TEST_AUTH` blocked in production |
| Invitation tokens | SHA-256 hashed at rest, expiry, single-use |

Reference: `docs/STAGE_1_SECURITY_REVIEW.md`, `docs/OAUTH_SECURITY.md`

## OAuth security

| Provider category | Controls |
|-------------------|----------|
| Social (Meta, LinkedIn, TikTok) | State tokens, PKCE, encrypted credentials |
| Analytics (GA4, GSC) | Scoped permissions, refresh flows |
| Advertising (Google, Meta, LinkedIn, TikTok) | Developer tokens server-only; plan hash binding |
| Email (SES, SendGrid, etc.) | credentialsRef in secret manager |
| Stripe | Server-only keys; webhook HMAC |

Tokens are never returned in API responses or logged.

## IDOR and tenant isolation

**Controls:**
- `brandService.getById(organisationId, brandId)` on every brand operation
- `withApiHandler` enforces organisation context + permission
- Public endpoints resolve tenant server-side only
- Dashboard APIs reject mismatched `organisationId` header

**Tests:** `tests/unit/v1-tenant-isolation.test.ts`, per-stage integration tests.

Reference: `docs/V1_TENANT_ISOLATION_REVIEW.md`

## RBAC

| Risk | Mitigation |
|------|------------|
| Privilege escalation | `canManageMember`, `canChangeRole` protect owners |
| Viewer write access | Write permissions denied to VIEWER |
| Sensitive data exposure | `crm.viewSensitiveContact`, `marketingData.viewRaw` |
| Emergency controls | ADMIN/OWNER only for advertising emergency, budget freeze |

Reference: `docs/RBAC.md`, `docs/CRM_PERMISSIONS.md`

## XSS and injection

| Vector | Mitigation |
|--------|------------|
| Stored XSS | React rendering; CSP headers |
| SVG uploads | Script stripping in sanitiser |
| Form field values | HTML/scripts stripped on submit |
| CSV injection | Export sanitisation module |
| SQL injection | Prisma parameterised queries; analyst whitelist (no arbitrary SQL) |

## SSRF

| Module | Control |
|--------|---------|
| SEO crawler | Domain verification gate; robots.txt respect |
| Advertising webhooks | N/A — no advertising webhooks |
| Automation webhooks | URL validation; approval required for webhook actions |
| Connector adapters | Allowlisted provider endpoints only |

Stage 4 documents DNS rebinding as a known restriction.

## Rate limiting

| Endpoint / action | Limit |
|-------------------|-------|
| Auth (signup, login, reset) | Per-IP via `enforceAuthRateLimit` |
| Form submit | 20/min, 100/hour per IP per form |
| Tracking events | Per-IP rate limit |
| AI requests | Tenant rate limiter in `AIRequestService` |
| Provider APIs | Adapter-level backoff on 429 |

## Webhook security

| Webhook | Verification |
|---------|-------------|
| Stripe | HMAC signature (`STRIPE_WEBHOOK_SECRET`) |
| Email providers | Provider-specific signature parsing |
| Social (where configured) | Platform signature verification |

Idempotency via sync run records prevents replay processing.

## File and asset security

- MIME sniffing and extension blocklist
- Size limits per asset type
- Malware scan hook (integration point)
- Signed URLs for download
- SVG script content stripped

## Advertising mutation safety (Stage 5)

- SHA-256 plan hash binding on approvals
- 8 launch approval gates required
- Stale approval invalidation on plan change
- Idempotency keys on provider launches
- `assertNoDirectLlmMutation()` blocks LLM-sourced mutations
- Emergency shutdown flag (`ADVERTISING_EMERGENCY_SHUTDOWN`)

## Form submission security (Stage 6)

| Control | Value |
|---------|-------|
| Origin validation | `allowedOrigins` allowlist |
| Payload limit | 64KB |
| Field count | 50 max |
| IP storage | Hashed only |
| Honeypot/quarantine | Suspicious submissions quarantined, not deleted |

Reference: `docs/FORM_SUBMISSION_SECURITY.md`

## Email security (Stage 6)

- Suppression cannot be bypassed for marketing
- Domain verification (SPF/DKIM/DMARC) before send
- Webhook bounce/complaint auto-suppression
- Credentials via `credentialsRef`, never in logs

## Findings

| Severity | Finding | Mitigation |
|----------|---------|------------|
| Medium | Typecheck errors in permissions.ts (duplicate keys) | Fix before unrestricted production |
| Low | Regex-based sensitive targeting detection (advertising) | Human review required |
| Low | No distributed rate limiting (in-memory) | Acceptable for beta; Redis post-V1 |
| Low | SEO crawler DNS rebinding protection partial | Verified domains only in beta |
| Info | Audit events not wired to all paths | Core paths covered; expand post-V1 |

## Production security checklist

- [ ] `ALLOW_TEST_AUTH=false`
- [ ] `ALLOW_AI_DIAGNOSTICS=false`
- [ ] `ALLOW_DEV_SEED` unset
- [ ] Unique `ENCRYPTION_KEY` per environment
- [ ] OAuth redirect URIs match `APP_URL`
- [ ] Stripe webhook secret rotated per environment
- [ ] CSP headers active (verify in staging)

## No critical findings

Security posture aligns with Stage 1 baseline across all six stages. Restrictions documented in `docs/V1_KNOWN_LIMITATIONS.md`.
