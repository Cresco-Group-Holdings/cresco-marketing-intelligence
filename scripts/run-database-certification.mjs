#!/usr/bin/env node

/**
 * Task 3 database certification runner — aggregates live operational evidence.
 * Emits aggregate JSON only; never prints connection strings or row payloads.
 *
 * Canonical credential env vars (see docs/TASK_3_DATABASE_CERTIFICATION.md):
 *   STAGING_CERTIFICATION_DATABASE_URL — staging live certification (read-only audits + RLS)
 *   PRODUCTION_AUDIT_DATABASE_URL       — production read-only audit (must use read-only DB role)
 *   RESTORE_VALIDATION_DATABASE_URL     — isolated restore/recovery validation target
 *
 * Usage:
 *   node scripts/run-database-certification.mjs --target ci
 *   node scripts/run-database-certification.mjs --target staging
 *   node scripts/run-database-certification.mjs --target production
 *   node scripts/run-database-certification.mjs --target restored
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TARGETS = {
  ci: {
    envKey: "DATABASE_URL",
    fallbackKeys: ["ANALYTICS_TEST_DATABASE_URL", "DIRECT_URL"],
    runRls: true,
    runIntegrity: true,
    runBaseline: true,
    runTenantTests: true,
  },
  staging: {
    envKey: "STAGING_CERTIFICATION_DATABASE_URL",
    fallbackKeys: ["STAGING_DIRECT_URL", "ANALYTICS_TEST_DATABASE_URL", "DATABASE_URL"],
    runRls: true,
    runIntegrity: true,
    runBaseline: true,
    runTenantTests: false,
  },
  production: {
    envKey: "PRODUCTION_AUDIT_DATABASE_URL",
    fallbackKeys: ["PRODUCTION_DIRECT_URL", "DATABASE_URL", "DIRECT_URL"],
    runRls: false,
    runIntegrity: true,
    runBaseline: true,
    runTenantTests: false,
  },
  restored: {
    envKey: "RESTORE_VALIDATION_DATABASE_URL",
    fallbackKeys: ["DATABASE_URL", "DIRECT_URL"],
    runRls: true,
    runIntegrity: true,
    runBaseline: true,
    runTenantTests: false,
  },
};

const PHASE_DEFINITIONS = [
  { id: "staging_baseline", label: "Staging baseline", targets: ["staging", "restored"] },
  { id: "staging_rls", label: "Staging RLS (PostgREST roles)", targets: ["staging", "restored"] },
  { id: "staging_tenant_ab", label: "Staging Tenant A/B", targets: ["staging"] },
  { id: "staging_integrity", label: "Staging data integrity", targets: ["staging", "restored"] },
  { id: "production_baseline", label: "Production read-only baseline", targets: ["production"] },
  { id: "production_integrity", label: "Production read-only integrity", targets: ["production"] },
  { id: "restore_validation", label: "Restore validation", targets: ["restored"] },
  { id: "ci_baseline", label: "CI baseline", targets: ["ci"] },
  { id: "ci_rls", label: "CI RLS", targets: ["ci"] },
  { id: "ci_tenant_ab", label: "CI Tenant A/B", targets: ["ci"] },
  { id: "ci_integrity", label: "CI data integrity", targets: ["ci"] },
];

function parseArgs() {
  const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
  const target = targetArg?.split("=")[1] ?? process.argv[process.argv.indexOf("--target") + 1] ?? "ci";
  if (!TARGETS[target]) {
    console.error(`Unknown target "${target}". Use: ${Object.keys(TARGETS).join(", ")}`);
    process.exit(1);
  }
  return target;
}

function resolveDatabaseUrl(targetConfig) {
  for (const key of [targetConfig.envKey, ...targetConfig.fallbackKeys]) {
    const value = process.env[key]?.trim();
    if (value) return { key, value };
  }
  return null;
}

function runNodeScript(script, env) {
  const output = execSync(`node ${script}`, {
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return output.trim();
}

function aggregateIntegrityCategories(report) {
  const categories = {
    orphans: 0,
    duplicates: 0,
    stale_reservations: 0,
    stuck_jobs: 0,
    publication_anomalies: 0,
    provider_anomalies: 0,
    billing_anomalies: 0,
    automation_anomalies: 0,
    activation_anomalies: 0,
    analytics_anomalies: 0,
  };

  for (const finding of report.findings ?? []) {
    const count = finding.count ?? 0;
    if (finding.category === "orphans") categories.orphans += count;
    else if (finding.category === "duplicates") categories.duplicates += count;
    else if (finding.id === "stale_usage_reservations") categories.stale_reservations += count;
    else if (finding.category === "worker_integrity") categories.stuck_jobs += count;
    else if (finding.category === "publication_integrity") categories.publication_anomalies += count;
    else if (finding.category === "provider_integrity") categories.provider_anomalies += count;
    else if (finding.category === "billing_integrity") categories.billing_anomalies += count;
    else if (finding.category === "automation_integrity") categories.automation_anomalies += count;
    else if (finding.category === "analytics_integrity") categories.analytics_anomalies += count;
    else if (finding.category === "content_integrity") categories.activation_anomalies += count;
  }

  return categories;
}

function buildPhaseMatrix(target, steps, databaseConfigured) {
  const stepByName = Object.fromEntries(steps.map((step) => [step.name, step]));
  const matrix = {};

  function phaseResult(phaseId, applicable, passFn) {
    if (!applicable) {
      matrix[phaseId] = "NOT REQUESTED";
      return;
    }
    if (!databaseConfigured) {
      matrix[phaseId] = "NOT CERTIFIED";
      return;
    }
    matrix[phaseId] = passFn() ? "PASS" : "FAIL";
  }

  phaseResult("staging_baseline", target === "staging" || target === "restored", () =>
    stepByName["database-baseline"]?.passed === true,
  );
  phaseResult("staging_rls", target === "staging" || target === "restored", () =>
    stepByName["rls-staging"]?.passed === true,
  );
  phaseResult(
    "staging_tenant_ab",
    target === "staging",
    () => stepByName["tenant-isolation-tests"]?.passed === true,
  );
  phaseResult("staging_integrity", target === "staging" || target === "restored", () =>
    stepByName["data-integrity"]?.passed === true,
  );
  phaseResult("production_baseline", target === "production", () =>
    stepByName["database-baseline"]?.passed === true,
  );
  phaseResult("production_integrity", target === "production", () =>
    stepByName["data-integrity"]?.passed === true,
  );
  phaseResult("restore_validation", target === "restored", () =>
    stepByName["database-baseline"]?.passed === true &&
    stepByName["data-integrity"]?.passed === true &&
    stepByName["rls-staging"]?.passed === true,
  );
  phaseResult("ci_baseline", target === "ci", () => stepByName["database-baseline"]?.passed === true);
  phaseResult("ci_rls", target === "ci", () => stepByName["rls-staging"]?.passed === true);
  phaseResult("ci_tenant_ab", target === "ci", () => stepByName["tenant-isolation-tests"]?.passed === true);
  phaseResult("ci_integrity", target === "ci", () => stepByName["data-integrity"]?.passed === true);

  return matrix;
}

async function main() {
  const target = parseArgs();
  const targetConfig = TARGETS[target];
  const resolved = resolveDatabaseUrl(targetConfig);

  const result = {
    generatedAt: new Date().toISOString(),
    target,
    databaseConfigured: Boolean(resolved),
    databaseEnvKey: resolved?.key ?? null,
    steps: [],
    phaseMatrix: {},
    passed: true,
  };

  if (!resolved) {
    result.passed = false;
    result.steps.push({
      name: "database-url",
      passed: false,
      detail: `No database URL configured for ${target} target.`,
    });
    result.phaseMatrix = buildPhaseMatrix(target, result.steps, false);
    for (const phase of PHASE_DEFINITIONS) {
      if (phase.targets.includes(target) && result.phaseMatrix[phase.id] === "NOT REQUESTED") {
        result.phaseMatrix[phase.id] = "NOT CERTIFIED";
      }
    }
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  const env = {
    DATABASE_URL: resolved.value,
    DIRECT_URL: resolved.value,
    ANALYTICS_TEST_DATABASE_URL: resolved.value,
  };

  if (targetConfig.runBaseline) {
    try {
      const baselineJson = runNodeScript("scripts/audit-database-baseline.mjs", env);
      const baseline = JSON.parse(baselineJson);
      const stepPass =
        baseline.pendingMigrationCount === 0 && baseline.failedMigrationCount === 0;
      result.steps.push({
        name: "database-baseline",
        passed: stepPass,
        pendingMigrations: baseline.pendingMigrationCount,
        failedMigrations: baseline.failedMigrationCount,
        appliedMigrationCount: baseline.appliedMigrationCount,
        latestAppliedMigration: baseline.latestAppliedMigration,
        lastRepositoryMigration: baseline.lastRepositoryMigration,
        postgresVersion: baseline.postgresVersion,
        databaseTarget: baseline.databaseTarget?.safeIdentifier ?? null,
      });
      if (!stepPass) result.passed = false;
    } catch (error) {
      result.passed = false;
      result.steps.push({
        name: "database-baseline",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (targetConfig.runIntegrity) {
    try {
      const integrityJson = runNodeScript("scripts/audit-data-integrity.mjs", env);
      const integrity = JSON.parse(integrityJson);
      const categories = aggregateIntegrityCategories(integrity);
      const stepPass = integrity.summary.p0Count === 0 && integrity.summary.p1Count === 0;
      result.steps.push({
        name: "data-integrity",
        passed: stepPass,
        p0Count: integrity.summary.p0Count,
        p1Count: integrity.summary.p1Count,
        p2Count: integrity.summary.p2Count,
        categories,
        migration: integrity.migration,
        rls: integrity.rls,
      });
      if (!stepPass) result.passed = false;
    } catch (error) {
      result.passed = false;
      result.steps.push({
        name: "data-integrity",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (targetConfig.runRls) {
    try {
      execSync("node scripts/verify-rls-staging.mjs", {
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });
      result.steps.push({ name: "rls-staging", passed: true });
    } catch (error) {
      result.passed = false;
      const output =
        error instanceof Error && "stdout" in error
          ? String(error.stdout ?? "") + String(error.stderr ?? "")
          : error instanceof Error
            ? error.message
            : String(error);
      const match = output.match(/(\d+)\/(\d+) checks passed/);
      result.steps.push({
        name: "rls-staging",
        passed: false,
        checksPassed: match ? Number(match[1]) : null,
        checksTotal: match ? Number(match[2]) : null,
        detail: output.split("\n").slice(-5).join(" "),
      });
    }
  }

  if (targetConfig.runTenantTests) {
    try {
      execSync(
        "npm run test:database -- tests/database/tenant-isolation-certification.test.ts tests/database/provider-cross-tenant.test.ts tests/database/rls-security.test.ts",
        {
          encoding: "utf8",
          env: { ...process.env, ...env, NODE_ENV: "test" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      result.steps.push({ name: "tenant-isolation-tests", passed: true });
    } catch (error) {
      result.passed = false;
      result.steps.push({
        name: "tenant-isolation-tests",
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  result.phaseMatrix = buildPhaseMatrix(target, result.steps, true);

  const artifactDir = path.join(process.cwd(), "artifacts", "database-certification");
  fs.mkdirSync(artifactDir, { recursive: true });
  const artifactPath = path.join(artifactDir, `${target}-certification.json`);
  fs.writeFileSync(artifactPath, JSON.stringify(result, null, 2));

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
