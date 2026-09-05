import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import {
  createTenant,
  databaseSuiteEnabled,
  prisma,
  resetDatabase,
} from "./helpers/analytics-fixtures";

const suite = databaseSuiteEnabled ? describe : describe.skip;

suite("Task 3 data integrity audit on clean database", () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTenant();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports zero P0/P1 findings on a freshly seeded tenant graph", () => {
    const output = execSync("node scripts/audit-data-integrity.mjs", {
      encoding: "utf8",
      env: process.env,
    });
    const report = JSON.parse(output) as {
      summary: { p0Count: number; p1Count: number; findingsCount: number };
    };

    expect(report.summary.p0Count).toBe(0);
    expect(report.summary.p1Count).toBe(0);
    expect(report.summary.findingsCount).toBe(0);
  });

  it("records a safe database baseline without secrets", () => {
    const output = execSync("node scripts/audit-database-baseline.mjs", {
      encoding: "utf8",
      env: process.env,
    });
    const baseline = JSON.parse(output) as {
      auditedSha: string;
      repositoryMigrationCount: number;
      databaseTarget: { safeIdentifier: string } | null;
    };

    expect(baseline.auditedSha).toMatch(/^[0-9a-f]{40}$/);
    expect(baseline.repositoryMigrationCount).toBeGreaterThan(0);
    expect(baseline.databaseTarget?.safeIdentifier).toContain("test:");
    expect(output).not.toMatch(/postgresql:\/\/.+:.+@/);
  });
});
