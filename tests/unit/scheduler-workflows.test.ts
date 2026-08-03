import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOWS = [
  "publishing-scheduler.yml",
  "social-analytics-scheduler.yml",
];

describe("production scheduler workflows", () => {
  for (const filename of WORKFLOWS) {
    const workflowPath = path.join(process.cwd(), ".github", "workflows", filename);

    it(`${filename} uses the production environment for secrets`, () => {
      const workflow = readFileSync(workflowPath, "utf8");

      expect(workflow).toContain("environment: production");
      expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
    });

    it(`${filename} skips gracefully when scheduler secrets are missing`, () => {
      const workflow = readFileSync(workflowPath, "utf8");

      expect(workflow).toContain("Skipping scheduler run");
      expect(workflow).toContain("exit 0");
    });
  }
});
