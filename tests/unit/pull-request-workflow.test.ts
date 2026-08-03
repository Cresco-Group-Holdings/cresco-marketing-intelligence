import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "pull-request.yml",
);

function readWorkflow(): string {
  return readFileSync(WORKFLOW_PATH, "utf8");
}

describe("pull-request workflow", () => {
  it("declares least-privilege permissions for PR path filtering", () => {
    const workflow = readWorkflow();

    expect(workflow).toMatch(
      /permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: read/,
    );
  });

  it("uses dorny/paths-filter for change detection", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("dorny/paths-filter@v3");
    expect(workflow).toContain("Detect changed paths");
  });

  it("sets DATABASE_URL and DIRECT_URL for Prisma validation", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("DATABASE_URL:");
    expect(workflow).toContain("DIRECT_URL:");
  });

  it("runs database tests only when prisma paths change or label is applied", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("run-database-tests");
    expect(workflow).toContain("needs.changes.outputs.prisma == 'true'");
  });
});
