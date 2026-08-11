import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { databaseSuiteEnabled, databaseUrl } from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Supabase RLS security (live database)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports postgres is not a PostgreSQL superuser on Supabase", async () => {
    const rows = await prisma.$queryRaw<Array<{ rolsuper: boolean }>>`
      SELECT rolsuper FROM pg_roles WHERE rolname = 'postgres'
    `;
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

  it.each(privilegeCases)("revokes %s %s on Organisation", async (role, privilege) => {
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

      const anonSelect = await prisma.$queryRawUnsafe<Array<{ has_select: boolean }>>(
        `SELECT has_table_privilege('anon', 'public."${tableName}"', 'SELECT') AS has_select`,
      );
      expect(anonSelect[0]?.has_select).toBe(false);

      const svcSelect = await prisma.$queryRawUnsafe<Array<{ has_select: boolean }>>(
        `SELECT has_table_privilege('service_role', 'public."${tableName}"', 'SELECT') AS has_select`,
      );
      expect(svcSelect[0]?.has_select).toBe(false);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE public."${tableName}"`);
    }
  });
});
