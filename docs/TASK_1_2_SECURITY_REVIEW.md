# Task 1.2 Security Review

Date: 2026-07-28

## Threats reviewed

| Threat | Review outcome |
| --- | --- |
| IDOR via resource IDs | Mitigated — all reads/mutations validate organisation membership and scope by `organisationId` / `projectId` |
| Cross-tenant access | Mitigated — tenant context required for org-scoped APIs; client-supplied org IDs are not trusted |
| Privilege escalation | Mitigated — central permission matrix + `canChangeRole` / owner-protection checks |
| Mass assignment | Mitigated — Zod schemas whitelist fields; protected fields excluded from update payloads |
| Unsafe redirects | Existing safe redirect validation retained for auth callback |
| Invitation token leakage | Mitigated — only SHA-256 hashes stored; raw token shown only in non-production API response for OWNER/ADMIN |
| Archived resource access | Mitigated — archived orgs/projects/brands excluded from default selectors and service lookups |
| Owner removal race conditions | Partially mitigated — `assertAtLeastOneOwnerRemains` used before demotion/removal; transactional updates recommended for future hardening |
| Audit log tampering | Mitigated — no update/delete APIs for audit logs |
| Browser secret exposure | Mitigated — service role and provider keys remain server-only |

## Controls implemented

- Central RBAC in `src/lib/tenancy/permissions.ts`
- Permission enforcement in `withApiHandler` for all tenant mutations
- Membership status checks (`ACTIVE` only) in tenant guards
- Invitation hashing and expiry validation
- Workspace preference validation against accessible resources
- Structured audit events for all mutations listed in Task 1.2 spec
- Development-only invitation URL exposure gated by `NODE_ENV !== "production"`

## Residual risks

- In-memory rate limiting is not distributed across instances
- Owner role transitions should move to explicit database transactions with row-level locking in high-concurrency environments
- Email delivery for invitations is not implemented — acceptance depends on secure token delivery out of band
- Test auth bypass (`ALLOW_TEST_AUTH`) must never be enabled in production
- File upload for logos is not implemented — URL fields accept user-supplied values and should be validated at CDN integration time

## Deferred to future tasks

- OAuth token encrypted storage
- Email invitation delivery
- MFA and enterprise SSO
- WAF / edge rate limiting
- Formal penetration testing
