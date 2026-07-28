# Task 1.2 Pre-Flight Audit

Date: 2026-07-28  
Base: Task 1.1 merged in PR #1 (`39e8510`)

## Current architecture

The application follows the layered structure defined in `docs/ARCHITECTURE.md`:

- **UI:** `src/app/`, `src/components/`
- **Features:** `src/features/` (stubs only)
- **API:** `src/app/api/` (GET health + organisations)
- **Services:** `src/server/services/` (minimal)
- **Repositories:** `src/server/repositories/` (list queries, unused)
- **Libraries:** `src/lib/` (auth, tenancy, security, API envelope, env)

Build, lint, typecheck, and 16 unit tests pass on `main`.

## Reusable components

| Area | Reusable for Task 1.2 |
| --- | --- |
| `DashboardShell`, `PageHeader`, `ModuleEmptyState` | Yes |
| `dashboard-header.tsx` | Replace placeholder selectors |
| `button`, `card`, `input`, `badge` | Yes — extend with select/dialog |
| `src/lib/tenancy/guards.ts` | Extend with permissions |
| `src/lib/api/response.ts` | Keep as standard envelope |
| `src/lib/tenancy/context.ts` | Extend with brand context |
| Prisma models (org, project, brand, membership) | Expand fields + new models |

## Missing prerequisites (addressed in Task 1.2)

1. **User profile provisioning** — `requireAuthenticatedUser()` failed without profile; added idempotent provisioning.
2. **RBAC permission matrix** — only role ranking existed; central permissions added.
3. **CRUD APIs** — only GET `/api/organisations`; full REST surface added.
4. **WorkspacePreference model** — missing; added for persisted selectors.
5. **BrandProfile, Invitation models** — missing; added.
6. **Workspace selectors** — placeholders only; wired to API.
7. **Onboarding flow** — missing; `/onboarding` added.
8. **Member management** — missing; settings pages + APIs added.
9. **Request validation (Zod)** — env only; shared schemas added.
10. **Audit events on mutations** — `recordAuditEvent` unused; wired to all mutations.

## Deviations from Task 1.1 (preserved, not rewritten)

- Repositories existed but were bypassed by services — services now use repositories consistently.
- `validateEnvironmentOnStartup()` not called at boot — unchanged (non-blocking).
- Auth UI was placeholder — provisioning and workspace flows added; Supabase remains auth provider.
- `userId` on `UserProfile` renamed to `authUserId` per Task 1.2 spec via migration.
- `userProfileId` on `OrganisationMembership` renamed to `userId` (references `UserProfile.id`).

## Minimum prerequisite fixes applied

- Idempotent `ensureUserProfile()` for authenticated users
- Expanded Prisma schema + new migration (no edits to applied `20250728090000_init`)
- Central RBAC module replacing scattered role checks
- API route helper for consistent auth/tenant/permission handling

## Verification before implementation

| Check | Result |
| --- | --- |
| Application builds | Pass |
| Prisma migration valid | Pass (init migration present) |
| Auth foundation | Supabase SSR + middleware |
| Tenant helpers | Present |
| API envelope | Present |
| No business logic in components | Mostly true; forms call server actions/API |

Task 1.2 implementation proceeds on branch `cursor/workspace-management-e94c`.
