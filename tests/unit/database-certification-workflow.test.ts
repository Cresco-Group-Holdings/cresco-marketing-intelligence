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

  it("uses canonical staging certification credential in protected environment", () => {
    expect(workflow).toContain("environment: staging-certification");
    expect(workflow).toContain("STAGING_CERTIFICATION_DATABASE_URL");
    expect(workflow).toContain("--target staging");
  });

  it("uses canonical production audit credential in protected environment", () => {
    expect(workflow).toContain("environment: production-audit");
    expect(workflow).toContain("PRODUCTION_AUDIT_DATABASE_URL");
    expect(workflow).toContain("--target production");
    expect(workflow).toContain("verify-production-migration.mjs");
  });

  it("supports optional restore validation in protected environment", () => {
    expect(workflow).toContain("environment: restore-validation");
    expect(workflow).toContain("RESTORE_VALIDATION_DATABASE_URL");
    expect(workflow).toContain("--target restored");
  });

  it("emits certification phase summary", () => {
    expect(workflow).toContain("certification-summary");
    expect(workflow).toContain("phaseMatrix");
    expect(workflow).toContain("NOT CERTIFIED");
  });
});
