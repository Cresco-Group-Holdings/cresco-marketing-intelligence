#!/usr/bin/env node

/**
 * CI guard: ensures Supabase RLS hardening migration and controls are present.
 */

import fs from "node:fs";
import path from "node:path";

const errors = [];
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const hardeningMigration = "20260811120000_supabase_rls_hardening";
const hardeningSqlPath = path.join(migrationsDir, hardeningMigration, "migration.sql");

if (!fs.existsSync(hardeningSqlPath)) {
  errors.push(`Missing required migration: ${hardeningMigration}`);
} else {
  const sql = fs.readFileSync(hardeningSqlPath, "utf8");
  const requiredFragments = [
    "ENABLE ROW LEVEL SECURITY",
    "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated, service_role",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    "ensure_public_table_rls",
    "trg_ensure_public_table_rls",
    "_prisma_migrations",
    "SET search_path = public, pg_temp",
  ];

  for (const fragment of requiredFragments) {
    if (!sql.includes(fragment)) {
      errors.push(`RLS hardening migration missing required fragment: ${fragment}`);
    }
  }

  if (/USING\s*\(\s*true\s*\)/i.test(sql)) {
    errors.push("RLS hardening migration contains permissive USING (true) policy — not allowed.");
  }
}

const migrationFolders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const hardeningIndex = migrationFolders.indexOf(hardeningMigration);
if (hardeningIndex === -1) {
  errors.push("RLS hardening migration folder not found.");
} else {
  for (const folder of migrationFolders.slice(hardeningIndex + 1)) {
    const sqlPath = path.join(migrationsDir, folder, "migration.sql");
    if (!fs.existsSync(sqlPath)) {
      continue;
    }

    const sql = fs.readFileSync(sqlPath, "utf8");

    if (/GRANT\s+.*\s+TO\s+(anon|authenticated|service_role)/i.test(sql)) {
      errors.push(`Migration ${folder} grants privileges to API-facing roles.`);
    }

    if (/USING\s*\(\s*true\s*\)/i.test(sql)) {
      errors.push(`Migration ${folder} contains permissive USING (true) RLS policy.`);
    }

    if (/DISABLE ROW LEVEL SECURITY/i.test(sql)) {
      errors.push(`Migration ${folder} disables row level security.`);
    }
  }
}

if (errors.length > 0) {
  console.error("RLS security validation failed:\n");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("RLS security validation passed.");
