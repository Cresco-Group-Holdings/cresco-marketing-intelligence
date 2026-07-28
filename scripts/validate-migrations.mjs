#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
const errors = [];

if (!fs.existsSync(migrationsDir)) {
  console.error("Missing prisma/migrations directory.");
  process.exit(1);
}

const migrationFolders = fs
  .readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrationFolders.length === 0) {
  errors.push("No migration folders found.");
}

for (const folder of migrationFolders) {
  const sqlPath = path.join(migrationsDir, folder, "migration.sql");
  if (!fs.existsSync(sqlPath)) {
    errors.push(`Missing migration.sql in ${folder}`);
  }
}

const lockPath = path.join(migrationsDir, "migration_lock.toml");
if (!fs.existsSync(lockPath)) {
  errors.push("Missing prisma/migrations/migration_lock.toml");
}

try {
  execSync("npx prisma validate", { stdio: "pipe" });
} catch (error) {
  errors.push("Prisma schema validation failed.");
  if (error instanceof Error && "stderr" in error) {
    errors.push(String(error.stderr ?? error.message));
  }
}

if (errors.length > 0) {
  console.error("Migration validation failed:");
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log(`Migration validation passed (${migrationFolders.length} migrations).`);
