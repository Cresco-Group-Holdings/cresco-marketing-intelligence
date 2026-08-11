import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  databaseSuiteEnabled,
  databaseUrl,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Supabase RLS security (live database)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
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

  it("revokes anon SELECT on Organisation", async () => {
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege('anon', 'public."Organisation"', 'SELECT') AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });

  it("revokes authenticated SELECT on Organisation", async () => {
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege('authenticated', 'public."Organisation"', 'SELECT') AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });

  it("revokes anon SELECT on _prisma_migrations", async () => {
    const rows = await prisma.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege('anon', 'public."_prisma_migrations"', 'SELECT') AS has_select
    `;
    expect(rows[0]?.has_select).toBe(false);
  });

  it("allows postgres role (Prisma runtime) to query Organisation", async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "Organisation"
    `;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThanOrEqual(0);
  });

  it("has ensure_public_table_rls event trigger installed", async () => {
    const rows = await prisma.$queryRaw<Array<{ evtname: string }>>`
      SELECT evtname FROM pg_event_trigger WHERE evtname = 'trg_ensure_public_table_rls'
    `;
    expect(rows.length).toBe(1);
  });

  it("enforces RLS default deny for anon on Brand (tenant table)", async () => {
    const client = prisma;
    const privilege = await client.$queryRaw<Array<{ has_select: boolean }>>`
      SELECT has_table_privilege('anon', 'public."Brand"', 'SELECT') AS has_select
    `;
    expect(privilege[0]?.has_select).toBe(false);
  });
});
