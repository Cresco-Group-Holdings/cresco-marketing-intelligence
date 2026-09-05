import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("database certification workflow", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/database-certification.yml");
  const workflow = fs.readFileSync(workflowPath, "utf8");

  it("requires CERTIFY_DATABASE confirmation", () => {
    expect(workflow).toContain('confirmation != \'CERTIFY_DATABASE\'');
    expect(workflow).toContain("Type CERTIFY_DATABASE to run live certification");
  });

  it("runs CI certification against Postgres 16 service", () => {
    expect(workflow).toContain("image: postgres:16");
    expect(workflow).toContain("node scripts/run-database-certification.mjs --target ci");
    expect(workflow).toContain("npm run test:database");
  });

  it("runs staging live certification with staging secrets", () => {
    expect(workflow).toContain("STAGING_DIRECT_URL: ${{ secrets.STAGING_DIRECT_URL || secrets.ANALYTICS_TEST_DATABASE_URL }}");
    expect(workflow).toContain("--target staging");
  });

  it("runs production read-only certification in production environment", () => {
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("PRODUCTION_DIRECT_URL: ${{ secrets.PRODUCTION_DIRECT_URL }}");
    expect(workflow).toContain("--target production");
  });

  it("supports optional restore validation target", () => {
    expect(workflow).toContain("RESTORE_VALIDATION_DATABASE_URL");
    expect(workflow).toContain("--target restored");
  });
});
