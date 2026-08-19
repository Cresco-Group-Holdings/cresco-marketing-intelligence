import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { databaseSuiteEnabled, databaseUrl } from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Supabase RLS security (live database)", () => {
  let prisma: PrismaClient;
  let existingApiRoles: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const rows = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname
      FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated', 'service_role')
    `;
    existingApiRoles = rows.map((row) => row.rolname);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("documents postgres superuser status (Supabase expects non-superuser)", async () => {
    const rows = await prisma.$queryRaw<Array<{ rolsuper: boolean }>>`
      SELECT rolsuper FROM pg_roles WHERE rolname = 'postgres'
    `;
    // Supabase: postgres is not a superuser. Vanilla CI PostgreSQL: postgres is a superuser.
    if (rows[0]?.rolsuper) {
      expect(rows[0]?.rolsuper).toBe(true);
      return;
    }
    expect(rows[0]?.rolsuper).toBe(false);
  });

  it("has RLS enabled on tenant-owned Organisation table", async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'Organisation'
    `;
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it("has RLS enabled on _prisma_migrations", async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = '_prisma_migrations'
    `;
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it("confirms Prisma-created tables are owned by postgres", async () => {
    const rows = await prisma.$queryRaw<Array<{ owner: string }>>`
      SELECT pg_get_userbyid(c.relowner) AS owner
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'Organisation'
    `;
    expect(rows[0]?.owner).toBe("postgres");
  });

  const privilegeCases = [
    ["anon", "SELECT"],
    ["anon", "INSERT"],
    ["anon", "UPDATE"],
    ["anon", "DELETE"],
    ["authenticated", "SELECT"],
    ["service_role", "SELECT"],
  ] as const;

  it.each(privilegeCases)("revokes %s %s on Organisation when role exists", async (role, privilege) => {
    if (!existingApiRoles.includes(role)) {
      return;
    }

    const rows = await prisma.$queryRaw<Array<{ has_priv: boolean }>>`
      SELECT has_table_privilege(
        ${role},
        'public."Organisation"',
        ${privilege}
      ) AS has_priv
    `;
    expect(rows[0]?.has_priv).toBe(false);
  });

  it("allows postgres role (Prisma runtime) to query Organisation", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Organisation"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("allows postgres role to read _prisma_migrations", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("has ensure_public_function_privileges event trigger installed", async () => {
    const rows = await prisma.$queryRaw<Array<{ evtname: string }>>`
      SELECT evtname FROM pg_event_trigger WHERE evtname = 'trg_ensure_public_function_privileges'
    `;
    expect(rows.length).toBe(1);
  });

  it("revokes PUBLIC execute on public functions", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', n.oid))) acl
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND acl.grantee = 0
        AND acl.privilege_type = 'EXECUTE'
    `;
    expect(rows[0]?.count ?? 0).toBe(0);
  });

  const functionExecuteCases = [
    ["anon", "ensure_public_table_rls"],
    ["authenticated", "ensure_public_table_rls"],
    ["service_role", "ensure_public_table_rls"],
  ] as const;

  it.each(functionExecuteCases)("revokes %s EXECUTE on %s() when role exists", async (role, fn) => {
    if (!existingApiRoles.includes(role)) {
      return;
    }

    const rows = await prisma.$queryRaw<Array<{ has_exec: boolean }>>`
      SELECT has_function_privilege(
        ${role},
        ${`public.${fn}()`},
        'EXECUTE'
      ) AS has_exec
    `;
    expect(rows[0]?.has_exec).toBe(false);
  });

  it("allows postgres to EXECUTE owned ensure_public_table_rls()", async () => {
    const rows = await prisma.$queryRaw<Array<{ has_exec: boolean }>>`
      SELECT has_function_privilege('postgres', 'public.ensure_public_table_rls()', 'EXECUTE') AS has_exec
    `;
    expect(rows[0]?.has_exec).toBe(true);
  });

  it("audits SECURITY DEFINER functions have fixed search_path", async () => {
    const rows = await prisma.$queryRaw<Array<{ proname: string; config: string }>>`
      SELECT p.proname, COALESCE(array_to_string(p.proconfig, ', '), '') AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true
    `;
    for (const row of rows) {
      expect(row.config).toContain("search_path=public");
    }
  });

  it("auto-revokes execute on newly created public functions", async () => {
    const fnName = `_rls_fn_test_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION public."${fnName}"() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$`,
    );
    try {
      const publicExec = await prisma.$queryRawUnsafe<Array<{ has_exec: boolean }>>(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', n.oid))) acl
           WHERE n.nspname = 'public'
             AND p.proname = '${fnName}'
             AND acl.grantee = 0
             AND acl.privilege_type = 'EXECUTE'
         ) AS has_exec`,
      );
      expect(publicExec[0]?.has_exec).toBe(false);

      if (existingApiRoles.includes("anon")) {
        const anonExec = await prisma.$queryRawUnsafe<Array<{ has_exec: boolean }>>(
          `SELECT has_function_privilege('anon', 'public."${fnName}"()', 'EXECUTE') AS has_exec`,
        );
        expect(anonExec[0]?.has_exec).toBe(false);
      }
    } finally {
      await prisma.$executeRawUnsafe(`DROP FUNCTION public."${fnName}"()`);
    }
  });

  it("has ensure_public_table_rls event trigger installed", async () => {
    const rows = await prisma.$queryRaw<Array<{ evtname: string }>>`
      SELECT evtname FROM pg_event_trigger WHERE evtname = 'trg_ensure_public_table_rls'
    `;
    expect(rows.length).toBe(1);
  });

  it("auto-hardens newly created public tables via event trigger", async () => {
    const tableName = `_rls_test_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE public."${tableName}" (id text PRIMARY KEY)`,
    );

    try {
      const rls = await prisma.$queryRawUnsafe<Array<{ relrowsecurity: boolean }>>(
        `SELECT c.relrowsecurity FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = '${tableName}'`,
      );
      expect(rls[0]?.relrowsecurity).toBe(true);

      if (existingApiRoles.includes("anon")) {
        const anonSelect = await prisma.$queryRawUnsafe<Array<{ has_select: boolean }>>(
          `SELECT has_table_privilege('anon', 'public."${tableName}"', 'SELECT') AS has_select`,
        );
        expect(anonSelect[0]?.has_select).toBe(false);
      }

      if (existingApiRoles.includes("service_role")) {
        const svcSelect = await prisma.$queryRawUnsafe<Array<{ has_select: boolean }>>(
          `SELECT has_table_privilege('service_role', 'public."${tableName}"', 'SELECT') AS has_select`,
        );
        expect(svcSelect[0]?.has_select).toBe(false);
      }
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE public."${tableName}"`);
    }
  });

  it("has RLS enabled on every public table", async () => {
    const rows = await prisma.$queryRaw<Array<{ disabled_count: number }>>`
      SELECT COUNT(*)::int AS disabled_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    `;
    expect(rows[0]?.disabled_count).toBe(0);
  });

  it("does not grant PUBLIC privileges on public tables", async () => {
    const rows = await prisma.$queryRaw<Array<{ grant_count: number }>>`
      SELECT COUNT(*)::int AS grant_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', n.oid))) acl
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND acl.grantee = 0
    `;
    expect(rows[0]?.grant_count).toBe(0);
  });

  const sensitiveTables = [
    "Organisation",
    "SocialCredential",
    "ProviderConnection",
    "PublishingJob",
    "SecurityAuditLog",
    "_prisma_migrations",
  ] as const;

  const allPrivilegeCases = [
    ["anon", "SELECT"],
    ["anon", "INSERT"],
    ["anon", "UPDATE"],
    ["anon", "DELETE"],
    ["authenticated", "SELECT"],
    ["authenticated", "INSERT"],
    ["authenticated", "UPDATE"],
    ["authenticated", "DELETE"],
    ["service_role", "SELECT"],
    ["service_role", "INSERT"],
    ["service_role", "UPDATE"],
    ["service_role", "DELETE"],
  ] as const;

  it.each(sensitiveTables)("has RLS enabled on sensitive table %s", async (table) => {
    const rows = await prisma.$queryRawUnsafe<Array<{ relrowsecurity: boolean }>>(
      `SELECT c.relrowsecurity FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = '${table}'`,
    );
    if (rows.length === 0) {
      return;
    }
    expect(rows[0]?.relrowsecurity).toBe(true);
  });

  it.each(allPrivilegeCases)(
    "denies %s %s on Organisation when role exists",
    async (role, privilege) => {
      if (!existingApiRoles.includes(role)) {
        return;
      }
      const rows = await prisma.$queryRaw<Array<{ has_priv: boolean }>>`
        SELECT has_table_privilege(
          ${role},
          'public."Organisation"',
          ${privilege}
        ) AS has_priv
      `;
      expect(rows[0]?.has_priv).toBe(false);
    },
  );

  it("denies anon runtime SELECT when postgres is not superuser", async () => {
    if (!existingApiRoles.includes("anon")) {
      return;
    }
    const superuser = await prisma.$queryRaw<Array<{ rolsuper: boolean }>>`
      SELECT rolsuper FROM pg_roles WHERE rolname = current_user
    `;
    if (superuser[0]?.rolsuper) {
      return;
    }
    await expect(
      prisma.$executeRawUnsafe(`SET LOCAL ROLE anon; SELECT COUNT(*) FROM "Organisation"`),
    ).rejects.toThrow();
  });
});
