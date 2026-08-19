#!/usr/bin/env node

/**
 * Live catalogue verification: fails if any public ordinary table has RLS disabled.
 *
 * Usage:
 *   DIRECT_URL="postgresql://..." node scripts/validate-rls-catalogue.mjs
 *   ANALYTICS_TEST_DATABASE_URL="postgresql://..." node scripts/validate-rls-catalogue.mjs
 */

import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.ANALYTICS_TEST_DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("Set ANALYTICS_TEST_DATABASE_URL, DIRECT_URL, or DATABASE_URL.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*)::int AS total_tables,
      COUNT(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
      COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::int AS rls_disabled
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
  `;

  const stats = rows[0] ?? { total_tables: 0, rls_enabled: 0, rls_disabled: 0 };

  console.log("RLS catalogue:", stats);

  if (stats.total_tables === 0) {
    console.error("No public ordinary tables found — run prisma migrate deploy first.");
    process.exit(1);
  }

  if (stats.rls_disabled > 0) {
    const disabled = await prisma.$queryRaw`
      SELECT c.relname AS table_name
      FROM pg_class c
      INNER JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
      ORDER BY c.relname
      LIMIT 25
    `;
    console.error(`RLS catalogue validation failed: ${stats.rls_disabled} table(s) without RLS.`);
    console.error("Sample:", disabled.map((r) => r.table_name).join(", "));
    process.exit(1);
  }

  console.log("RLS catalogue validation passed.");
} finally {
  await prisma.$disconnect();
}
