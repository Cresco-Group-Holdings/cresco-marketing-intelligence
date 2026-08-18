#!/usr/bin/env node

/**
 * CI guard: ensures Supabase RLS hardening migration and controls are present.
 */

import fs from "node:fs";
import path from "node:path";

const errors = [];
const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const hardeningMigration = "20260811120000_supabase_rls_hardening";
const reinforcementMigration = "20260818210000_supabase_rls_hardening_reinforcement";
const reinforcementSqlPath = path.join(migrationsDir, reinforcementMigration, "migration.sql");

if (!fs.existsSync(reinforcementSqlPath)) {
  errors.push(`Missing required migration: ${reinforcementMigration}`);
} else {
  const reinforcementSql = fs.readFileSync(reinforcementSqlPath, "utf8");
  const reinforcementFragments = [
    "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC",
    "REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC",
    "REVOKE ALL ON TABLE %s FROM PUBLIC",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
  ];
  for (const fragment of reinforcementFragments) {
    if (!reinforcementSql.includes(fragment)) {
      errors.push(`RLS reinforcement migration missing required fragment: ${fragment}`);
    }
  }
  if (/USING\s*\(\s*true\s*\)/i.test(reinforcementSql)) {
    errors.push("RLS reinforcement migration contains permissive USING (true) policy.");
  }
}

const hardeningSqlPath = path.join(migrationsDir, hardeningMigration, "migration.sql");

if (!fs.existsSync(hardeningSqlPath)) {
  errors.push(`Missing required migration: ${hardeningMigration}`);
} else {
  const sql = fs.readFileSync(hardeningSqlPath, "utf8");
  const requiredFragments = [
    "ENABLE ROW LEVEL SECURITY",
    "ARRAY['anon', 'authenticated', 'service_role']",
    "REVOKE ALL ON ALL TABLES IN SCHEMA public",
    "REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC",
    "REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC",
    "ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public",
    "ensure_public_table_rls",
    "ensure_public_function_privileges",
    "trg_ensure_public_table_rls",
    "trg_ensure_public_function_privileges",
    "_prisma_migrations",
    "SET search_path = public, pg_temp",
    "pg_roles WHERE rolname = api_role",
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

    if (/GRANT\s+.*\s+TO\s+(anon|authenticated|service_role|PUBLIC)/i.test(sql)) {
      errors.push(`Migration ${folder} grants privileges to API-facing or PUBLIC roles.`);
    }

    if (/GRANT\s+EXECUTE\s+ON\s+FUNCTION/i.test(sql) && /TO\s+PUBLIC/i.test(sql)) {
      errors.push(`Migration ${folder} grants EXECUTE on functions to PUBLIC.`);
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
