import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_DIR = path.join(process.cwd(), ".github", "workflows");

describe("production scheduler workflows", () => {
  it("worker-platform-scheduler.yml invokes canonical dispatcher every 5 minutes", () => {
    const workflow = readFileSync(
      path.join(WORKFLOW_DIR, "worker-platform-scheduler.yml"),
      "utf8",
    );

    expect(workflow).toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("/api/workers/dispatch");
    expect(workflow).toContain("/api/workers/process");
    expect(workflow).toContain("/api/workers/automation-schedules");
    expect(workflow).toContain("/api/workers/recover");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("worker-platform-scheduler");
  });

  it("publishing-scheduler.yml uses production environment and curl-based manual fallback", () => {
    const workflow = readFileSync(
      path.join(WORKFLOW_DIR, "publishing-scheduler.yml"),
      "utf8",
    );

    expect(workflow).toContain("environment: production");
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/^\s+schedule:/m);
    expect(workflow).toContain("curl --fail-with-body");
    expect(workflow).toContain("must be configured in the production environment");
    expect(workflow).toContain("exit 1");
  });

  it("social-analytics-scheduler.yml uses production environment and graceful skip", () => {
    const workflow = readFileSync(
      path.join(WORKFLOW_DIR, "social-analytics-scheduler.yml"),
      "utf8",
    );

    expect(workflow).toContain("environment: production");
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/);
    expect(workflow).toContain("Skipping scheduler run");
    expect(workflow).toContain("exit 0");
    expect(workflow).toContain("curl --fail-with-body");
    expect(workflow).toContain("timeout-minutes: 2");
  });
});
