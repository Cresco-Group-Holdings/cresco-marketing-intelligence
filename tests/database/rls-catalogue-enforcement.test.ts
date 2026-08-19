import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { databaseSuiteEnabled, databaseUrl } from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

type RlsCatalogueRow = {
  total_tables: bigint;
  rls_enabled: bigint;
  rls_disabled: bigint;
};

/**
 * Production acceptance query — must return rls_disabled = 0 after migrate deploy.
 */
async function queryRlsCatalogue(prisma: PrismaClient): Promise<RlsCatalogueRow> {
  const rows = await prisma.$queryRaw<RlsCatalogueRow[]>`
    SELECT
      COUNT(*)::bigint AS total_tables,
      COUNT(*) FILTER (WHERE c.relrowsecurity)::bigint AS rls_enabled,
      COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::bigint AS rls_disabled
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  `;
  return rows[0] ?? { total_tables: BigInt(0), rls_enabled: BigInt(0), rls_disabled: BigInt(0) };
}

suite("RLS catalogue enforcement (pg_class ground truth)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("has zero public ordinary tables with relrowsecurity=false", async () => {
    const stats = await queryRlsCatalogue(prisma);

    expect(Number(stats.total_tables)).toBeGreaterThan(0);
    expect(Number(stats.rls_disabled)).toBe(0);
    expect(Number(stats.rls_enabled)).toBe(Number(stats.total_tables));
  });

  it("matches per-table pg_class.relrowsecurity flags", async () => {
    const disabled = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT c.relname AS table_name
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
      LIMIT 50
    `;

    expect(disabled).toEqual([]);
  });

  it("includes _prisma_migrations in the RLS-enabled set", async () => {
    const rows = await prisma.$queryRaw<Array<{ relrowsecurity: boolean }>>`
      SELECT c.relrowsecurity
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = '_prisma_migrations'
    `;

    if (rows.length === 0) {
      return;
    }

    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
