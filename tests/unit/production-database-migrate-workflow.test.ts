import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "production-database-migrate.yml",
);

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

function extractMigrateJobBlock(workflow: string): string {
  const start = workflow.indexOf("  migrate-production:");
  const end = workflow.indexOf("  reject-invalid-confirmation:");
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe("production-database-migrate workflow", () => {
  it("sets DATABASE_URL and DIRECT_URL at the migrate job level", () => {
    const jobBlock = extractMigrateJobBlock(readWorkflow());

    expect(jobBlock).toMatch(
      /env:\s*\n\s*DATABASE_URL: \$\{\{ secrets\.PRODUCTION_DIRECT_URL \}\}\s*\n\s*DIRECT_URL: \$\{\{ secrets\.PRODUCTION_DIRECT_URL \}\}/,
    );
  });

  it("keeps the missing production secret guard", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("Verify production database secret is configured");
    expect(workflow).toContain('if [ -z "$PRODUCTION_DIRECT_URL" ]; then');
    expect(workflow).toContain(
      "PRODUCTION_DIRECT_URL is not configured in the production environment.",
    );
  });

  it("runs prisma commands that inherit job-level database env vars", () => {
    const jobBlock = extractMigrateJobBlock(readWorkflow());
    const stepsSection = jobBlock.slice(jobBlock.indexOf("steps:"));

    for (const command of [
      "npx prisma validate",
      "npx prisma migrate status",
      "npx prisma migrate deploy",
      "npx prisma generate",
      "node scripts/verify-production-migration.mjs",
    ]) {
      expect(stepsSection).toContain(command);
    }

    expect(stepsSection).not.toMatch(
      /^\s+DATABASE_URL: \$\{\{ secrets\.PRODUCTION_DIRECT_URL \}\}/m,
    );
    expect(stepsSection).not.toMatch(/^\s+DIRECT_URL: \$\{\{ secrets\.PRODUCTION_DIRECT_URL \}\}/m);
  });
});

describe("prisma validate with synthetic database URLs", () => {
  it("passes when DATABASE_URL and DIRECT_URL are both set", async () => {
    const syntheticUrl = "postgresql://postgres.tests@tests-project.supabase.co:5432/postgres";

    process.env.DATABASE_URL = syntheticUrl;
    process.env.DIRECT_URL = syntheticUrl;

    const { execSync } = await import("node:child_process");
    expect(() => {
      execSync("npx prisma validate", {
        stdio: "pipe",
        env: {
          ...process.env,
          DATABASE_URL: syntheticUrl,
          DIRECT_URL: syntheticUrl,
        },
      });
    }).not.toThrow();
  });
});
