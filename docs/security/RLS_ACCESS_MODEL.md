# RLS Access Model

## Purpose

This document defines the canonical database access model for Cresco Marketing Intelligence on
Supabase PostgreSQL. It reconciles Supabase Security Advisor requirements with the application's
Prisma-only server architecture.

## Roles

### `anon`

- **No access** to tenant, user, credential, worker, or internal tables in `public`.
- Supabase Auth may use `anon` for JWT issuance only; application data is not queryable.
- All `public` table/sequence/function grants are revoked when the role exists.

### `authenticated`

- **No direct SQL access** to `public` application tables.
- Organisation membership is enforced in the **application layer** (`TenantContext`, Prisma queries
  filtered by `organisationId`).
- Future PostgREST exposure would require both `GRANT` restoration **and** explicit RLS policies
  using `public.is_organisation_member()` — this is intentionally not enabled.

### `service_role`

- Used **server-side only** for Supabase Auth admin and Storage APIs (`auth.*`, `storage.*`).
- Has `rolbypassrls = true` on Supabase but **no grants** on `public` application tables.
- Must not be used from browser clients.

### `postgres` (Prisma runtime / migrations)

- Owns tables created by Prisma migrations in `public`.
- **Bypasses RLS** as table owner (FORCE ROW LEVEL SECURITY is not enabled).
- All application reads/writes, workers, OAuth callbacks, publishing, and analytics run through this role.

## RLS strategy

| Layer | Mechanism |
|-------|-----------|
| Security Advisor compliance | `ENABLE ROW LEVEL SECURITY` on every `public` table |
| Default deny for API roles | Zero permissive policies + revoked grants |
| New tables (migrations) | `trg_ensure_public_table_rls` event trigger |
| New functions | `trg_ensure_public_function_privileges` revokes PUBLIC execute |
| Tenant isolation | Application `organisationId` filters + membership guards |
| Credential protection | RLS + no grants + server-only encryption services |

## Why policies are not granted to `authenticated`

The platform does **not** use Supabase PostgREST/Data API for application entities. Mapping
`auth.uid()` to `UserProfile.id` for hundreds of tables would duplicate tenancy logic, risk policy
drift, and could expose data if grants were accidentally restored.

Defense-in-depth posture:

1. RLS enabled (Security Advisor: not "RLS Disabled")
2. No permissive policies for `anon` / `authenticated`
3. Grants revoked for API roles
4. Prisma server enforces `organisationId` scoping

## Membership helper

`public.is_organisation_member(organisation_id text, user_profile_id text)` is available for
auditing and future policy work. It queries `"OrganisationMembership"` with `status = 'ACTIVE'`.

- `SECURITY DEFINER` with fixed `search_path`
- `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated`, `service_role`
- Not required for current Prisma-only access path

## `_prisma_migrations`

- RLS enabled
- API-role grants revoked
- `postgres` owner retains full access for `prisma migrate deploy`

## Exceptions

See `docs/security/rls-exceptions.json`. Currently **zero** approved exceptions.
