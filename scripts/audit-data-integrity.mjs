#!/usr/bin/env node

/**
 * Read-only data integrity audit. Emits aggregate counts only — never row payloads.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/audit-data-integrity.mjs
 *   npm run audit:data-integrity
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSafeDatabaseOperation, classifyDatabaseTarget } from "./lib/database-environment-guard.mjs";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? process.env.ANALYTICS_TEST_DATABASE_URL;

if (!databaseUrl) {
  console.error("Set DATABASE_URL, DIRECT_URL, or ANALYTICS_TEST_DATABASE_URL for the audit target.");
  process.exit(1);
}

assertSafeDatabaseOperation({ operation: "audit", databaseUrl });

/** @type {Array<{ id: string; category: string; description: string; sql: string; severity: "P0"|"P1"|"P2" }>} */
const CHECKS = [
  {
    id: "orphan_projects",
    category: "orphans",
    description: "Projects without Organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "Project" p
          LEFT JOIN "Organisation" o ON o.id = p."organisationId"
          WHERE o.id IS NULL`,
  },
  {
    id: "orphan_brands",
    category: "orphans",
    description: "Brands without Project",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "Brand" b
          LEFT JOIN "Project" p ON p.id = b."projectId"
          WHERE p.id IS NULL`,
  },
  {
    id: "orphan_provider_accounts",
    category: "orphans",
    description: "ProviderConnectionAccount without ProviderConnection",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "ProviderConnectionAccount" a
          LEFT JOIN "ProviderConnection" c ON c.id = a."connectionId"
          WHERE c.id IS NULL`,
  },
  {
    id: "orphan_content_provenance",
    category: "orphans",
    description: "ContentProvenance without ContentItem",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "ContentProvenance" cp
          LEFT JOIN "ContentItem" ci ON ci.id = cp."contentItemId"
          WHERE ci.id IS NULL`,
  },
  {
    id: "orphan_publications",
    category: "orphans",
    description: "PublishingJob without ContentSchedule",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "PublishingJob" pj
          LEFT JOIN "ContentSchedule" cs ON cs.id = pj."contentScheduleId"
          WHERE cs.id IS NULL`,
  },
  {
    id: "orphan_worker_jobs",
    category: "orphans",
    description: "WorkerJob without Organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "WorkerJob" wj
          LEFT JOIN "Organisation" o ON o.id = wj."organisationId"
          WHERE o.id IS NULL`,
  },
  {
    id: "orphan_automation_executions",
    category: "orphans",
    description: "AutomationExecution without AutomationWorkflow",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "AutomationExecution" ae
          LEFT JOIN "AutomationWorkflow" aw ON aw.id = ae."workflowId"
          WHERE aw.id IS NULL`,
  },
  {
    id: "orphan_usage_records",
    category: "orphans",
    description: "UsageRecord without Organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "UsageRecord" ur
          LEFT JOIN "Organisation" o ON o.id = ur."organisationId"
          WHERE o.id IS NULL`,
  },
  {
    id: "orphan_attribution_journeys",
    category: "orphans",
    description: "AttributionJourney without Organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "AttributionJourney" aj
          LEFT JOIN "Organisation" o ON o.id = aj."organisationId"
          WHERE o.id IS NULL`,
  },
  {
    id: "duplicate_worker_idempotency",
    category: "duplicates",
    description: "Duplicate WorkerJob idempotency keys globally",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM (
            SELECT "idempotencyKey", COUNT(*) AS c
            FROM "WorkerJob"
            GROUP BY 1
            HAVING COUNT(*) > 1
          ) d`,
  },
  {
    id: "duplicate_publishing_idempotency",
    category: "duplicates",
    description: "Duplicate PublishingJob idempotency keys within organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM (
            SELECT "organisationId", "idempotencyKey", COUNT(*) AS c
            FROM "PublishingJob"
            GROUP BY 1, 2
            HAVING COUNT(*) > 1
          ) d`,
  },
  {
    id: "duplicate_usage_idempotency",
    category: "duplicates",
    description: "Duplicate UsageRecord idempotency keys within organisation",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM (
            SELECT "organisationId", "idempotencyKey", COUNT(*) AS c
            FROM "UsageRecord"
            GROUP BY 1, 2
            HAVING COUNT(*) > 1
          ) d`,
  },
  {
    id: "duplicate_billing_event_refs",
    category: "duplicates",
    description: "Duplicate BillingEvent external references",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM (
            SELECT "externalEventRef", COUNT(*) AS c
            FROM "BillingEvent"
            GROUP BY 1
            HAVING COUNT(*) > 1
          ) d`,
  },
  {
    id: "provider_connection_org_mismatch",
    category: "provider_integrity",
    description: "ProviderConnectionAccount organisation mismatch vs connection",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM "ProviderConnectionAccount" a
          JOIN "ProviderConnection" c ON c.id = a."connectionId"
          WHERE a."organisationId" <> c."organisationId"`,
  },
  {
    id: "content_without_brand",
    category: "content_integrity",
    description: "ContentItem without Brand",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "ContentItem" ci
          LEFT JOIN "Brand" b ON b.id = ci."brandId"
          WHERE b.id IS NULL`,
  },
  {
    id: "publication_foreign_account",
    category: "publication_integrity",
    description: "ContentSchedule socialAccount from different organisation",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM "ContentSchedule" cs
          JOIN "SocialAccount" sa ON sa.id = cs."socialAccountId"
          WHERE cs."organisationId" <> sa."organisationId"`,
  },
  {
    id: "worker_running_expired_lease",
    category: "worker_integrity",
    description: "RUNNING WorkerJob with expired lease",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "WorkerJob"
          WHERE status = 'RUNNING'
            AND "leaseExpiresAt" IS NOT NULL
            AND "leaseExpiresAt" < NOW()`,
  },
  {
    id: "stale_usage_reservations",
    category: "billing_integrity",
    description: "Active usage reservations past TTL",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "UsageRecord"
          WHERE metadata->>'reservationStatus' = 'active'
            AND (metadata->>'expiresAt')::timestamptz < NOW()`,
  },
  {
    id: "billing_customer_cross_org",
    category: "billing_integrity",
    description: "BillingAccount Stripe customer reused across organisations",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM (
            SELECT "stripeCustomerId", COUNT(DISTINCT "organisationId") AS orgs
            FROM "BillingAccount"
            WHERE "stripeCustomerId" IS NOT NULL
            GROUP BY 1
            HAVING COUNT(DISTINCT "organisationId") > 1
          ) d`,
  },
  {
    id: "automation_execution_org_mismatch",
    category: "automation_integrity",
    description: "AutomationExecution organisation mismatch vs workflow",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM "AutomationExecution" ae
          JOIN "AutomationWorkflow" aw ON aw.id = ae."workflowId"
          WHERE ae."organisationId" <> aw."organisationId"`,
  },
  {
    id: "analytics_brand_org_mismatch",
    category: "analytics_integrity",
    description: "MarketingMetricObservation brand/org mismatch",
    severity: "P0",
    sql: `SELECT COUNT(*)::int AS count FROM "MarketingMetricObservation" m
          JOIN "Brand" b ON b.id = m."brandId"
          WHERE m."organisationId" <> b."organisationId"`,
  },
  {
    id: "scheduler_heartbeat_missing",
    category: "scheduler_integrity",
    description: "SchedulerHeartbeat table missing global row",
    severity: "P2",
    sql: `SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SchedulerHeartbeat')
          THEN (SELECT COUNT(*)::int FROM "SchedulerHeartbeat" WHERE id = 'global')
          ELSE -1 END AS count`,
  },
  {
    id: "scheduler_future_timestamp",
    category: "scheduler_integrity",
    description: "SchedulerHeartbeat with impossible future timestamps",
    severity: "P1",
    sql: `SELECT COUNT(*)::int AS count FROM "SchedulerHeartbeat"
          WHERE "lastInvokedAt" > NOW() + INTERVAL '5 minutes'
             OR "lastSucceededAt" > NOW() + INTERVAL '5 minutes'`,
  },
];

async function tableExists(prisma, tableName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function runCheck(prisma, check) {
  try {
    const rows = await prisma.$queryRawUnsafe(check.sql);
    const count = Number(Object.values(rows[0] ?? {})[0] ?? 0);
    return { ...check, count, skipped: false, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/relation .* does not exist|does not exist/i.test(message)) {
      return { ...check, count: null, skipped: true, error: "table_missing" };
    }
    return { ...check, count: null, skipped: false, error: message };
  }
}

async function main() {
  const target = classifyDatabaseTarget(databaseUrl);
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
    const repoMigrations = fs
      .readdirSync(path.join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    const appliedNames = new Set(applied.map((row) => row.migration_name));
    const pending = repoMigrations.filter((name) => !appliedNames.has(name));

    const rlsDisabled = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    `;

    const results = [];
    for (const check of CHECKS) {
      results.push(await runCheck(prisma, check));
    }

    const findings = results.filter((row) => !row.skipped && row.count > 0);
    const errors = results.filter((row) => row.error && row.error !== "table_missing");
    const p0 = findings.filter((row) => row.severity === "P0");
    const p1 = findings.filter((row) => row.severity === "P1");
    const p2 = findings.filter((row) => row.severity === "P2");

    const report = {
      generatedAt: new Date().toISOString(),
      target: {
        environment: target.environment,
        safeIdentifier: target.safeIdentifier,
        databaseName: target.databaseName,
        hostSuffix: target.hostSuffix,
      },
      postgresVersion: String(Object.values(versionRows[0] ?? {})[0] ?? "unknown").split(" ")[0],
      prismaVersion: JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"))
        .devDependencies?.prisma,
      migration: {
        repositoryCount: repoMigrations.length,
        appliedCount: applied.length,
        pendingCount: pending.length,
        failedCount: failed.length,
        latestApplied: applied[0]?.migration_name ?? null,
        pending,
      },
      rls: {
        tablesWithoutRls: Number(rlsDisabled[0]?.count ?? 0),
      },
      summary: {
        checksRun: results.length,
        checksSkipped: results.filter((row) => row.skipped).length,
        checksErrored: errors.length,
        findingsCount: findings.length,
        p0Count: p0.length,
        p1Count: p1.length,
        p2Count: p2.length,
      },
      findings: findings.map(({ id, category, description, severity, count }) => ({
        id,
        category,
        description,
        severity,
        count,
      })),
      checks: results.map(({ id, category, description, severity, count, skipped, error }) => ({
        id,
        category,
        description,
        severity,
        count,
        skipped,
        error,
      })),
    };

    console.log(JSON.stringify(report, null, 2));

    if (errors.length > 0 || p0.length > 0 || p1.length > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
