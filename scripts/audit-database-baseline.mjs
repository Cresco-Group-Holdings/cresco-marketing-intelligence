#!/usr/bin/env node

/**
 * Records a safe database baseline for Task 3 certification (no secrets).
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { classifyDatabaseTarget } from "./lib/database-environment-guard.mjs";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.ANALYTICS_TEST_DATABASE_URL;

function gitSha() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function gitMainSha() {
  try {
    return execSync("git rev-parse origin/main", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const repoMigrations = fs
    .readdirSync(path.join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const baseline = {
    generatedAt: new Date().toISOString(),
    auditedSha: gitSha(),
    mainSha: gitMainSha(),
    prismaVersion: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"))
      .devDependencies?.prisma,
    repositoryMigrationCount: repoMigrations.length,
    lastRepositoryMigration: repoMigrations.at(-1) ?? null,
    rlsMode: "enabled-on-all-public-tables-with-api-grants-revoked",
    applicationDatabaseRole: "postgres (Prisma owner role; bypasses RLS as table owner)",
    postgrestRoleBehavior: "anon/authenticated/service_role grants revoked on public schema",
    databaseTarget: databaseUrl ? classifyDatabaseTarget(databaseUrl) : null,
  };

  if (databaseUrl) {
    const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try {
      const versionRows = await prisma.$queryRaw`SELECT version()`;
      const migrationRows = await prisma.$queryRaw`
        SELECT migration_name, finished_at, rolled_back_at
        FROM "_prisma_migrations"
        ORDER BY finished_at DESC NULLS LAST
      `;
      const applied = migrationRows.filter((row) => row.finished_at && !row.rolled_back_at);
      const failed = migrationRows.filter((row) => !row.finished_at);
      const appliedNames = new Set(applied.map((row) => row.migration_name));
      baseline.postgresVersion = String(Object.values(versionRows[0] ?? {})[0] ?? "unknown");
      baseline.appliedMigrationCount = applied.length;
      baseline.latestAppliedMigration = applied[0]?.migration_name ?? null;
      baseline.pendingMigrationCount = repoMigrations.filter((name) => !appliedNames.has(name)).length;
      baseline.failedMigrationCount = failed.length;
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log(JSON.stringify(baseline, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
