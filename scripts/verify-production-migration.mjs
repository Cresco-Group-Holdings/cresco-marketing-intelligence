#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const REQUIRED_TABLES = [
  "_prisma_migrations",
  "UserProfile",
  "SecurityAuditLog",
  "Organisation",
  "ProviderConnection",
  "ProviderCredential",
  "ProviderOutboundSend",
];

function countRepositoryMigrations() {
  const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!databaseUrl) {
    console.error("DATABASE_URL or DIRECT_URL must be set for verification.");
    process.exit(1);
  }

  const repositoryMigrations = countRepositoryMigrations();
  const prisma = new PrismaClient();

  try {
    const migrationRows = await prisma.$queryRaw`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC NULLS LAST
    `;

    const applied = migrationRows.filter((row) => row.finished_at && !row.rolled_back_at);
    const failed = migrationRows.filter((row) => !row.finished_at);
    const appliedNames = new Set(applied.map((row) => row.migration_name));
    const pending = repositoryMigrations.filter((name) => !appliedNames.has(name));

    const tableRows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;

    const existingTables = new Set(
      tableRows
        .map((row) => row.table_name)
        .filter((tableName) => REQUIRED_TABLES.includes(tableName)),
    );
    const representativeTableExistence = Object.fromEntries(
      REQUIRED_TABLES.map((tableName) => [tableName, existingTables.has(tableName)]),
    );

    const report = {
      repositoryMigrationCount: repositoryMigrations.length,
      appliedMigrationCount: applied.length,
      pendingMigrationCount: pending.length,
      failedMigrationCount: failed.length,
      latestAppliedMigration: applied[0]?.migration_name ?? null,
      representativeTableExistence,
    };

    console.log(JSON.stringify(report, null, 2));

    const missingTables = REQUIRED_TABLES.filter((tableName) => !existingTables.has(tableName));
    if (pending.length > 0 || failed.length > 0 || missingTables.length > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Production migration verification failed.");
  if (error instanceof Error) {
    console.error(error.message);
  }
  process.exit(1);
});
