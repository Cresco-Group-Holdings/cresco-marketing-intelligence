# Security & Tenancy Audit

**Main SHA:** `8910740` | **Audit date:** 2026-08-16

---

## Tenancy model (Phase 11)

### Isolation mechanism

| Layer | Mechanism | Classification |
|-------|-----------|----------------|
| API | `organisationId` query param / `x-organisation-id` header | SAFE when enforced |
| Handler | `buildTenantContext` + membership check | SAFE |
| Permission | `hasPermission(role, permission)` | SAFE |
| Context | AsyncLocalStorage `TenantContext` | SAFE |
| Service | `where: { organisationId }` | SAFE (convention) |
| Service | `assertOrganisationScope()` | SAFE (select services) |
| Prisma | Direct queries | REVIEW — convention not enforced |
| Background jobs | Worker tokens; job payload orgId | REVIEW |
| RLS | API-role lockdown only | TENANT LEAK RISK if app bug |

### Suspicious paths

| Path | Issue | Classification |
|------|-------|----------------|
| `GET/PATCH /api/executive/preferences` | Membership only, no permission | REVIEW |
| `GET /api/dashboard/foundation` | Membership only | REVIEW |
| `GET /api/reports/shared/[token]` | Public token, no auth | REVIEW (by design) |
| `provider-webhooks` signature check | Plain compare to digest | REVIEW |
| Legacy `action: "revoke"` | Does not clear credentials | REVIEW |
| `onboarding` POST | Any auth user can create org | SAFE (intended) |

### Background job tenant handling

- Publishing jobs carry `organisationId` on job record
- Sync jobs scoped via connection → organisation
- Cron routes require `CRON_SECRET` or worker tokens
- **Risk:** misconfigured secrets could allow cross-tenant job triggering

---

## RBAC (Phase 12)

### Roles (rank order)

VIEWER (1) < ANALYST (2) < MARKETER (3) < ADMIN (4) < OWNER (5)

### Permission count: 318

### Role matrix (summary)

| Capability area | VIEWER | ANALYST | MARKETER | ADMIN | OWNER |
|-----------------|--------|---------|----------|-------|-------|
| Read dashboards | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create content | — | — | ✓ | ✓ | ✓ |
| Approve content | — | — | ✓ | ✓ | ✓ |
| Manage members | — | — | — | ✓ | ✓ |
| Billing | — | — | — | ✓ | ✓ |
| Audit logs | — | ✓ | — | ✓ | ✓ |
| Provider admin | — | — | partial | ✓ | ✓ |
| Advertising launch | — | — | partial | ✓ | ✓ |
| Archive organisation | — | — | — | — | ✓ |

### RBAC gaps

1. `requirePermission()` defined but **never called** — all checks via `hasPermission` in handler
2. ~43 routes authenticated without explicit permission (self-service, onboarding, executive prefs)
3. UI permission gating inconsistent — some buttons not disabled by role
4. `providerConnections.revoke` limited to ADMIN; legacy revoke has no credential clear

---

## Security audit (Phase 13)

### Authentication

| Control | Status |
|---------|--------|
| Supabase Auth | Implemented |
| Session refresh (middleware) | Implemented |
| Test auth bypass (`ALLOW_TEST_AUTH`) | Dev/test only |
| Password change / session mgmt | Implemented |

### Authorization

| Control | Status |
|---------|--------|
| 318 permissions | Implemented |
| Domain handler wrappers | ~50 files |
| API without permission | ~43 routes (see above) |

### Credentials & encryption

| Control | Status |
|---------|--------|
| `ENCRYPTION_KEY` for credentials | AES-256-GCM |
| OAuth state signing | HMAC-SHA256 |
| Secret scan CI (`audit:secrets`) | Implemented |
| No hardcoded API keys in provider code | Verified |

### API validation

| Control | Status |
|---------|--------|
| Zod schemas | Widespread |
| Rate limiting | Tracking, forms, some public routes |
| CSRF | OAuth state; limited elsewhere |

### Webhooks

| Route | Validation |
|-------|------------|
| Stripe | Signature |
| Social providers | Provider-specific |
| Provider webhooks | Endpoint secret digest compare |

### File uploads

- DAM upload routes with type validation (`file-type` package)
- Size limits in services

### Findings

| ID | Severity | Finding | Evidence |
|----|----------|---------|----------|
| SEC-001 | P1 | Application-only tenant isolation | No per-org RLS |
| SEC-002 | P1 | Mock OAuth tokens storable as real connections | `mock-social-adapter` |
| SEC-003 | P2 | Executive preferences no RBAC | `executive/preferences/route.ts` |
| SEC-004 | P2 | Public shared report tokens | `reports/shared/[token]` |
| SEC-005 | P2 | Legacy revoke leaves credentials | `provider-connection-service.ts` |
| SEC-006 | P2 | Worker/cron secrets required for jobs | Misconfig risk |
| SEC-007 | P3 | `requirePermission` dead code | `permissions.ts` |
| SEC-008 | P3 | 139 lint warnings (unused vars) | ESLint |
| SEC-009 | P3 | AI mock fallback silent in prod | `model-registry.ts` |
| SEC-010 | P3 | Webhook signature plain compare | `provider-webhooks` |

### Secret exposure search

- `NEXT_PUBLIC_*` — only Supabase URL/anon key (expected)
- `ENCRYPTION_KEY`, `CRON_SECRET`, worker tokens — server-only env
- `scripts/secret-scan.mjs` in CI

### PII handling

- CRM contact fields with `viewSensitiveContact` permission
- Lead export with permission checks
- Audit logs redact credentials via `credential-redaction.ts`

---

## Observability (Phase 21)

| Capability | Status |
|------------|--------|
| Request IDs | `createRequestId()` in handler |
| Structured audit logs | `AuditLog`, `ProviderAuditEvent`, `SecurityAuditLog` |
| Error tracking (Sentry etc.) | NOT IMPLEMENTED |
| Provider error normalization | `ProviderGatewayError`, `mapErrorToProviderCode` |
| Job failure persistence | PublishingJob, AutomationExecution statuses |
| OAuth failure logging | Audit events |
| Production diagnosability | PARTIAL — logs exist; no centralized APM |

---

## AI security (Phase 14 subset)

| Control | Status |
|---------|--------|
| Input/output safety scans | `content-safety.ts`, agent safety |
| Injection detection | `ai-core.test.ts` |
| Cost controls / quotas | `ai-request-service`, agent quotas |
| PII in prompts | Redaction utilities |
| Tool execution scope | DB reads scoped by tenant in executor |
