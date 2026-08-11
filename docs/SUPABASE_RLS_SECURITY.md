# Supabase RLS Security Hardening

Production security hardening to resolve Supabase Security Advisor **RLS Disabled in Public** findings.

## A. Original Security Advisor state

| Finding | Count |
|---------|-------|
| RLS Disabled in Public (errors) | 538 |
| Other warnings | 1 (requires Dashboard re-check after deploy) |

## B. Root cause analysis

1. **All Prisma application tables live in the `public` schema** (~563 models / ~538 advisor-flagged tables).
2. **No RLS was enabled** on any application table — Supabase defaults expose `public` tables to PostgREST when grants exist.
3. **Supabase auto-grants** `SELECT/INSERT/UPDATE/DELETE` on new tables to `anon`, `authenticated`, and `service_role`.
4. **The application does not use Supabase Data API** for application data (`supabase.from()` is never called). All tenant data flows through **server-side Prisma** and Next.js API routes with `organisationId` scoping.
5. Supabase client usage is limited to **Auth** (anon key / JWT) and **Storage** (service role, server-only).

**Conclusion:** The 538 findings are legitimate. API-facing roles could theoretically query tenant data through PostgREST if grants remained. The fix is **defense-in-depth lockdown**, not permissive RLS policies.

## C. Database access architecture

| Access path | Role | Schema | Application tables? |
|-------------|------|--------|---------------------|
| Prisma (`DATABASE_URL` / `DIRECT_URL`) | `postgres` | `public` | Yes — **table owner bypass** |
| Prisma migrations (`DIRECT_URL`) | `postgres` | `public` incl. `_prisma_migrations` | Yes — **table owner bypass** |
| Supabase Auth (browser/server) | `anon` / `authenticated` via JWT | `auth` | No |
| Supabase Storage (server) | `service_role` | `storage` | No (buckets only) |
| PostgREST / Data API | `anon` / `authenticated` / `service_role` | `public` | **Blocked after hardening** |

### PostgreSQL role properties (Supabase)

Run on staging/production:

```sql
SELECT rolname, rolsuper, rolbypassrls
FROM pg_roles
WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role');
```

**Expected on Supabase:**

| Role | `rolsuper` | `rolbypassrls` | Notes |
|------|------------|----------------|-------|
| `postgres` | **false** | false | NOT a PostgreSQL superuser |
| `anon` | false | false | PostgREST anonymous |
| `authenticated` | false | false | PostgREST JWT users |
| `service_role` | false | **true** | Server-only; bypasses RLS but still needs table grants |

### Why Prisma continues to work with RLS enabled

Supabase `postgres` is **not** a superuser. Prisma works because:

1. **Prisma migrations create tables as `postgres`**, making `postgres` the **table owner**.
2. PostgreSQL table **owners bypass RLS** by default (we do **not** use `FORCE ROW LEVEL SECURITY`).
3. Prisma runtime connects via `DATABASE_URL` as the same `postgres` role.

This is **not** database-enforced `organisationId` isolation for Prisma — application-layer tenant controls remain mandatory.

### Prisma table ownership

```sql
SELECT pg_get_userbyid(c.relowner) AS owner, COUNT(*)::int AS table_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY pg_get_userbyid(c.relowner);
```

**Expected:** `postgres` owns all Prisma-created application tables.

## D. Schema strategy — OPTION C (chosen)

| Option | Decision |
|--------|----------|
| A. public + comprehensive per-tenant RLS policies | Rejected — 500+ policies, no Data API consumer |
| B. Dedicated API schema | Rejected — large migration risk |
| **C. Disable/restrict Data API for application tables** | **Selected** — matches actual architecture |

**Implementation:**
- Enable RLS on all `public` tables (default deny for API roles)
- Revoke `anon`/`authenticated`/`service_role` grants on `public` tables, sequences, functions
- No `USING (true)` policies
- Event trigger auto-hardens new Prisma-created tables
- Default privileges prevent grant regression

## E. service_role audit

**Repository audit result:** `service_role` is used **only** for:

| File | Usage |
|------|-------|
| `src/lib/auth/supabase-service.ts` | Creates service client |
| `src/server/services/auth-service.ts` | `auth.admin.signOut()` — **auth schema** |
| `src/lib/storage/supabase-storage-provider.ts` | `storage.from(bucket)` — **storage schema** |

**No `supabase.from('public_table')` calls exist.** No application-data queries via `service_role`.

**Hardening action:** Revoke `public` schema table/sequence/function grants from `service_role`. Auth and Storage are unaffected (`auth.*`, `storage.*` schemas retain their own grants).

## F. Data API — safe to disable for application data

**Confirmed:** Zero `supabase.from()` application-table queries in the repository.

| Concern | Technology |
|---------|------------|
| Application data | Prisma / direct PostgreSQL (`postgres` role) |
| Authentication | Supabase Auth (`auth` schema) |
| File storage | Supabase Storage (`storage` schema, service role) |

The application does **not** depend on Supabase REST or GraphQL Data API for `public` schema tables.

### Recommended: disable public schema Data API exposure (manual Dashboard step)

Do **not** automate this — apply in Supabase Dashboard after staging verification:

1. Open **Supabase Dashboard** → your project
2. Go to **Project Settings** → **API**
3. Under **Data API Settings** → **Exposed schemas**
4. **Remove `public`** from the exposed schemas list (leave `storage` / `graphql_public` only if required)
5. Save and verify Auth sign-in and Storage uploads still work in staging

Alternative (if schema removal is not available in your plan UI): keep `public` exposed — RLS + revoked grants already block access. Removing exposure is defense-in-depth.

## G. Event trigger safety (`trg_ensure_public_table_rls`)

| Property | Behaviour |
|----------|-----------|
| Scope | `CREATE TABLE` in `public` schema only |
| System schemas | `auth`, `storage`, `extensions` unaffected |
| Recursion | `ALTER TABLE` / `REVOKE` do not fire `CREATE TABLE` — no self-trigger |
| Prisma migrations | `CREATE TABLE` during migrate → trigger fires → RLS + revoke applied automatically |
| `search_path` | Fixed to `public, pg_temp` — prevents injection |
| Dynamic SQL | `object_identity` from `pg_event_trigger_ddl_commands()` — catalog-sourced, not user input |
| Policies | None created — default deny only |

## H. Tenant isolation — what RLS does and does not do

| Layer | What it enforces |
|-------|------------------|
| **RLS + revoked grants (new)** | Blocks PostgREST/Data API access for `anon`, `authenticated`, `service_role` on `public` tables |
| **Application services (existing, mandatory)** | `organisationId` + `brandId` isolation for all Prisma queries |
| **API middleware (existing, mandatory)** | `requireOrganisationId`, RBAC permission checks |

**Do not claim** that RLS provides `organisationId` isolation for trusted Prisma connections. Prisma connects as `postgres` (table owner) and bypasses RLS. Cross-tenant protection for application logic remains entirely in the service/API layer.

## I. Table inventory by category

Generated by `npm run generate:rls-inventory` → `docs/SUPABASE_RLS_INVENTORY.json`

| Category | Label | Approx. count |
|----------|-------|---------------|
| A | Tenant-owned application data | 416 |
| B | User-owned application data | 8 |
| D | Internal system tables | 133 |
| E | Background job / queue tables | 3 |
| F | Webhook/event tables | 2 |
| G | Audit/security tables | 1 |
| **Total** | | **563** |

## J. Grants revoked

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres ... REVOKE ALL ... FROM anon, authenticated, service_role;
```

`GRANT USAGE ON SCHEMA public` retained for PostgREST introspection.

## K. `_prisma_migrations` handling

- Remains in `public` (Prisma requirement)
- RLS enabled, no client policies
- `anon`/`authenticated`/`service_role` grants revoked
- Prisma migrate uses `postgres` (table owner) via `DIRECT_URL` — **unaffected**

## L. Security tests and staging verification

| Suite | Command |
|-------|---------|
| Unit (migration SQL) | `npm run test:unit -- tests/unit/rls-security.test.ts` |
| Live database | `ANALYTICS_TEST_DATABASE_URL=... npm run test:database -- tests/database/rls-security.test.ts` |
| Full staging script | `ANALYTICS_TEST_DATABASE_URL=... npm run verify:rls-staging` |
| Deploy + verify | `RLS_VERIFY_RUN_MIGRATE=1 ANALYTICS_TEST_DATABASE_URL=... npm run verify:rls-staging` |
| CI guard | `npm run validate:rls-security` (in `npm run build`) |

### Staging checklist (mandatory before merge)

- [ ] `prisma migrate deploy` succeeds
- [ ] Prisma runtime queries succeed
- [ ] `_prisma_migrations` readable by postgres
- [ ] `anon` cannot SELECT/INSERT/UPDATE/DELETE on application tables
- [ ] `authenticated` cannot access application tables
- [ ] `service_role` has no grants on `public` application tables
- [ ] New table auto-receives RLS + revoked grants (event trigger)
- [ ] Auth sign-in/sign-out works
- [ ] Storage upload/signed URL works
- [ ] Application API tenant operations work
- [ ] Security Advisor re-run shows 0 RLS errors

## M. Migration file

`prisma/migrations/20260811120000_supabase_rls_hardening/migration.sql`

## N. Intentionally accepted findings

None planned. If a future table requires authenticated Data API access, add **explicit tenant-scoped policies** — never `USING (true)`.
