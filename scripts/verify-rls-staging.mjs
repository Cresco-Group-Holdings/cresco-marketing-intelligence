#!/usr/bin/env node

/**
 * Staging verification for Supabase RLS hardening.
 *
 * Usage:
 *   ANALYTICS_TEST_DATABASE_URL="postgresql://..." node scripts/verify-rls-staging.mjs
 *
 * Optional:
 *   RLS_VERIFY_RUN_MIGRATE=1  — run `npx prisma migrate deploy` before checks
 */

import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.ANALYTICS_TEST_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "Set ANALYTICS_TEST_DATABASE_URL to a staging Supabase direct connection string.\n" +
      "Do not use localhost DATABASE_URL for staging verification.",
  );
  process.exit(1);
}

const results = [];
let failed = false;

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? `: ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? `: ${detail}` : ""}`);
  failed = true;
}

async function assertFalse(prisma, label, sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  const value = Object.values(rows[0] ?? {})[0];
  if (value === false || value === "f") {
    pass(label);
  } else {
    fail(label, `expected false, got ${value}`);
  }
}

async function main() {
  if (process.env.RLS_VERIFY_RUN_MIGRATE === "1") {
    console.log("Running prisma migrate deploy...");
    execSync("npx prisma migrate deploy", {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
    });
    pass("prisma migrate deploy");
  }

  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

  try {
    const roles = await prisma.$queryRaw`
      SELECT rolname, rolsuper, rolbypassrls
      FROM pg_roles
      WHERE rolname IN ('postgres', 'anon', 'authenticated', 'service_role')
      ORDER BY rolname
    `;
    console.log("\nRole properties:");
    console.table(roles);
    pass("role property query");

    const owners = await prisma.$queryRaw`
      SELECT pg_get_userbyid(c.relowner) AS owner, COUNT(*)::int AS table_count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      GROUP BY pg_get_userbyid(c.relowner)
      ORDER BY table_count DESC
      LIMIT 5
    `;
    console.log("\nPublic table ownership:");
    console.table(owners);
    pass("table ownership query");

    const postgresRole = roles.find((r) => r.rolname === "postgres");
    if (postgresRole?.rolsuper === true) {
      fail("postgres rolsuper", "expected false on Supabase");
    } else {
      pass("postgres is not superuser", `rolsuper=${postgresRole?.rolsuper}`);
    }

    const rlsOrg = await prisma.$queryRaw`
      SELECT c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'Organisation'
    `;
    if (rlsOrg[0]?.relrowsecurity) pass("RLS enabled on Organisation");
    else fail("RLS enabled on Organisation");

    await assertFalse(
      prisma,
      "anon cannot SELECT Organisation",
      `SELECT has_table_privilege('anon', 'public."Organisation"', 'SELECT') AS v`,
    );
    await assertFalse(
      prisma,
      "anon cannot INSERT Organisation",
      `SELECT has_table_privilege('anon', 'public."Organisation"', 'INSERT') AS v`,
    );
    await assertFalse(
      prisma,
      "anon cannot UPDATE Organisation",
      `SELECT has_table_privilege('anon', 'public."Organisation"', 'UPDATE') AS v`,
    );
    await assertFalse(
      prisma,
      "anon cannot DELETE Organisation",
      `SELECT has_table_privilege('anon', 'public."Organisation"', 'DELETE') AS v`,
    );
    await assertFalse(
      prisma,
      "authenticated cannot SELECT Organisation",
      `SELECT has_table_privilege('authenticated', 'public."Organisation"', 'SELECT') AS v`,
    );
    await assertFalse(
      prisma,
      "service_role cannot SELECT Organisation (grants revoked)",
      `SELECT has_table_privilege('service_role', 'public."Organisation"', 'SELECT') AS v`,
    );

    const trigger = await prisma.$queryRaw`
      SELECT evtname FROM pg_event_trigger WHERE evtname = 'trg_ensure_public_table_rls'
    `;
    if (trigger.length === 1) pass("event trigger installed");
    else fail("event trigger installed");

    const testTable = `_rls_verify_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `CREATE TABLE public."${testTable}" (id text PRIMARY KEY)`,
    );
    try {
      const newRls = await prisma.$queryRawUnsafe(
        `SELECT c.relrowsecurity AS rls FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = '${testTable}'`,
      );
      if (newRls[0]?.rls) pass("event trigger enables RLS on new table");
      else fail("event trigger enables RLS on new table");

      await assertFalse(
        prisma,
        "new table revokes anon SELECT",
        `SELECT has_table_privilege('anon', 'public."${testTable}"', 'SELECT') AS v`,
      );
      await assertFalse(
        prisma,
        "new table revokes service_role SELECT",
        `SELECT has_table_privilege('service_role', 'public."${testTable}"', 'SELECT') AS v`,
      );
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE public."${testTable}"`);
    }

    const orgCount = await prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "Organisation"`;
    pass("Prisma runtime query succeeds", `count=${orgCount[0]?.count}`);

    const migrations = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
    `;
    pass("Prisma migration history readable", `rows=${migrations[0]?.count}`);
  } catch (error) {
    fail("verification error", error instanceof Error ? error.message : String(error));
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed.`);
  process.exit(failed ? 1 : 0);
}

main();
