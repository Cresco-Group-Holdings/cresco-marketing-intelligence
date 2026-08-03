import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(
  process.cwd(),
  ".github",
  "workflows",
  "scheduled-security-audit.yml",
);

describe("scheduled-security-audit workflow", () => {
  it("sets synthetic database URLs for Prisma validation", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toMatch(
      /env:\s*\n\s*DATABASE_URL: postgresql:\/\/postgres:postgres@localhost:5432\/cresco_marketing/,
    );
    expect(workflow).toMatch(
      /DIRECT_URL: postgresql:\/\/postgres:postgres@localhost:5432\/cresco_marketing/,
    );
  });

  it("declares read-only contents permission", () => {
    const workflow = readFileSync(WORKFLOW_PATH, "utf8");

    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
  });
});
