#!/usr/bin/env node

/**
 * Blocks destructive Prisma/database commands from targeting production unintentionally.
 *
 * Usage:
 *   node scripts/guard-destructive-database-command.mjs migrate_dev
 *   node scripts/guard-destructive-database-command.mjs migrate_deploy --allow-production
 */

import { assertSafeDatabaseOperation } from "./lib/database-environment-guard.mjs";

const operation = process.argv[2];
const allowProduction = process.argv.includes("--allow-production");

const allowedOperations = new Set([
  "migrate_dev",
  "migrate_deploy",
  "db_push",
  "db_seed",
  "truncate",
  "audit",
]);

if (!operation || !allowedOperations.has(operation)) {
  console.error(
    "Usage: node scripts/guard-destructive-database-command.mjs <migrate_dev|migrate_deploy|db_push|db_seed|truncate|audit> [--allow-production]",
  );
  process.exit(1);
}

try {
  const target = assertSafeDatabaseOperation({
    operation,
    allowProduction,
  });
  console.log(`Database target allowed for ${operation}: ${target.safeIdentifier}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
