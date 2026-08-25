# Cresco Permission Matrix (Launch)

Canonical organisation roles and high-level permissions. Full permission keys live in `src/lib/tenancy/permissions.ts`.

| Capability | Owner | Admin | Marketer | Analyst | Viewer |
| --- | --- | --- | --- | --- | --- |
| Organisation settings | ✓ | ✓ | — | — | — |
| Organisation deletion | ✓ | — | — | — | — |
| Member management | ✓ | ✓ | — | — | — |
| Billing management | ✓ | ✓ | — | — | — |
| Provider connections | ✓ | ✓ | ✓ | — | — |
| Brand / Brand Knowledge edit | ✓ | ✓ | ✓ | — | — |
| Content Studio / publishing | ✓ | ✓ | ✓ | — | — |
| AI generation | ✓ | ✓ | ✓ | — | — |
| Analytics read | ✓ | ✓ | ✓ | ✓ | — (marketing data read) |
| Analytics import/sync | ✓ | ✓ | ✓ | — | — |
| Automations | ✓ | ✓ | ✓ | — | — |
| Audit log read | ✓ | ✓ | — | — | — |
| Operations / incidents | ✓ | ✓ | — | — | — |

**Enforcement:** All mutations verify permissions server-side via `withApiHandler({ permission })` and `requirePermission()`. Client UI hiding is not a security boundary.

**Tenant scope:** Every query is scoped by `organisationId` and, where applicable, `brandId` / `projectId` through `TenantContext`.
