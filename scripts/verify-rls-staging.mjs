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

    const rlsCatalogue = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS total_tables,
        COUNT(*) FILTER (WHERE c.relrowsecurity)::int AS rls_enabled,
        COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::int AS rls_disabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `;
    console.log("\nRLS catalogue (production acceptance):");
    console.table(rlsCatalogue);
    if ((rlsCatalogue[0]?.rls_disabled ?? 0) === 0 && (rlsCatalogue[0]?.total_tables ?? 0) > 0) {
      pass("all public tables have RLS enabled (rls_disabled=0)");
    } else {
      fail(
        "all public tables have RLS enabled",
        `rls_disabled=${rlsCatalogue[0]?.rls_disabled}, total=${rlsCatalogue[0]?.total_tables}`,
      );
    }

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

    const funcCount = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prokind = 'f'
    `;
    pass("public function inventory", `count=${funcCount[0]?.count}`);

    const publicExecuteFuncs = await prisma.$queryRaw`
      SELECT p.proname AS name
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prokind = 'f'
        AND has_function_privilege('PUBLIC', p.oid, 'EXECUTE')
      ORDER BY p.proname
      LIMIT 20
    `;
    if (publicExecuteFuncs.length === 0) {
      pass("no PUBLIC execute grants on public functions");
    } else {
      fail(
        "no PUBLIC execute grants on public functions",
        publicExecuteFuncs.map((f) => f.name).join(", "),
      );
    }

    await assertFalse(
      prisma,
      "anon cannot EXECUTE ensure_public_table_rls",
      `SELECT has_function_privilege('anon', 'public.ensure_public_table_rls()', 'EXECUTE') AS v`,
    );
    await assertFalse(
      prisma,
      "authenticated cannot EXECUTE ensure_public_table_rls",
      `SELECT has_function_privilege('authenticated', 'public.ensure_public_table_rls()', 'EXECUTE') AS v`,
    );
    await assertFalse(
      prisma,
      "service_role cannot EXECUTE ensure_public_table_rls",
      `SELECT has_function_privilege('service_role', 'public.ensure_public_table_rls()', 'EXECUTE') AS v`,
    );

    const postgresCanExec = await prisma.$queryRaw`
      SELECT has_function_privilege('postgres', 'public.ensure_public_table_rls()', 'EXECUTE') AS v
    `;
    if (postgresCanExec[0]?.v === true) pass("postgres can EXECUTE owned security functions");
    else fail("postgres can EXECUTE owned security functions");

    const secDefiner = await prisma.$queryRaw`
      SELECT p.proname AS name, COALESCE(array_to_string(p.proconfig, ', '), '') AS config
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef = true
      ORDER BY p.proname
    `;
    console.log("\nSECURITY DEFINER functions in public:");
    console.table(secDefiner);
    for (const fn of secDefiner) {
      if (!fn.config.includes("search_path=public")) {
        fail(`SECURITY DEFINER ${fn.name} missing fixed search_path`, fn.config);
      } else {
        pass(`SECURITY DEFINER ${fn.name} has fixed search_path`);
      }
    }

    const funcTrigger = await prisma.$queryRaw`
      SELECT evtname FROM pg_event_trigger WHERE evtname = 'trg_ensure_public_function_privileges'
    `;
    if (funcTrigger.length === 1) pass("function privilege event trigger installed");
    else fail("function privilege event trigger installed");

    const testFunc = `_rls_fn_${Date.now()}`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION public."${testFunc}"() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$`,
    );
    try {
      await assertFalse(
        prisma,
        "new function revokes PUBLIC execute",
        `SELECT has_function_privilege('PUBLIC', 'public."${testFunc}"()', 'EXECUTE') AS v`,
      );
      await assertFalse(
        prisma,
        "new function revokes anon execute",
        `SELECT has_function_privilege('anon', 'public."${testFunc}"()', 'EXECUTE') AS v`,
      );
    } finally {
      await prisma.$executeRawUnsafe(`DROP FUNCTION public."${testFunc}"()`);
    }

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
