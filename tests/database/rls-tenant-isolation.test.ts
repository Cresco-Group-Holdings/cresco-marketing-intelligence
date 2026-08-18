import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { databaseSuiteEnabled, databaseUrl } from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("RLS tenant isolation and access control (live database)", () => {
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

  it("has RLS enabled on all public application tables", async () => {
    const rows = await prisma.$queryRaw<Array<{ table_name: string; rls_enabled: boolean }>>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    `;
    const disabled = rows.filter((row) => !row.rls_enabled);
    expect(disabled).toEqual([]);
  });

  it("has is_organisation_member helper installed", async () => {
    const rows = await prisma.$queryRaw<Array<{ proname: string }>>`
      SELECT proname FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'is_organisation_member'
    `;
    expect(rows.length).toBe(1);
  });

  it("revokes anon EXECUTE on is_organisation_member when role exists", async () => {
    if (!existingApiRoles.includes("anon")) return;
    const rows = await prisma.$queryRaw<Array<{ has_exec: boolean }>>`
      SELECT has_function_privilege(
        'anon',
        'public.is_organisation_member(text, text)',
        'EXECUTE'
      ) AS has_exec
    `;
    expect(rows[0]?.has_exec).toBe(false);
  });

  const sensitiveTables = ["ProviderCredential", "OAuthTransaction", "Organisation"] as const;

  it.each(sensitiveTables)("blocks anon SELECT on %s when role exists", async (table) => {
    if (!existingApiRoles.includes("anon")) return;
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege(
        'anon',
        ${`public."${table}"`},
        'SELECT'
      ) AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });

  it.each(sensitiveTables)("blocks authenticated SELECT on %s when role exists", async (table) => {
    if (!existingApiRoles.includes("authenticated")) return;
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege(
        'authenticated',
        ${`public."${table}"`},
        'SELECT'
      ) AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });

  it("allows postgres backend to query Organisation (Prisma path)", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Organisation"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("allows postgres backend to query PublishingJob (worker path)", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "PublishingJob"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("allows postgres backend to read _prisma_migrations", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("blocks anon INSERT on Organisation when role exists", async () => {
    if (!existingApiRoles.includes("anon")) return;
    const rows = await prisma.$queryRaw<Array<{ has_insert: boolean }>>`
      SELECT has_table_privilege('anon', 'public."Organisation"', 'INSERT') AS has_insert
    `;
    expect(rows[0]?.has_insert).toBe(false);
  });

  it("blocks anon UPDATE on Organisation when role exists", async () => {
    if (!existingApiRoles.includes("anon")) return;
    const rows = await prisma.$queryRaw<Array<{ has_update: boolean }>>`
      SELECT has_table_privilege('anon', 'public."Organisation"', 'UPDATE') AS has_update
    `;
    expect(rows[0]?.has_update).toBe(false);
  });

  it("blocks anon DELETE on Organisation when role exists", async () => {
    if (!existingApiRoles.includes("anon")) return;
    const rows = await prisma.$queryRaw<Array<{ has_delete: boolean }>>`
      SELECT has_table_privilege('anon', 'public."Organisation"', 'DELETE') AS has_delete
    `;
    expect(rows[0]?.has_delete).toBe(false);
  });

  it("blocks service_role SELECT on ProviderCredential when role exists", async () => {
    if (!existingApiRoles.includes("service_role")) return;
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege(
        'service_role',
        'public."ProviderCredential"',
        'SELECT'
      ) AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });
});
