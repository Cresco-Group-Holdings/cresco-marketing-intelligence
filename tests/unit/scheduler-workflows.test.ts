import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCH_SCHEDULER_CADENCE } from "@/lib/deployment/scheduling";

const WORKFLOW_DIR = path.join(process.cwd(), ".github", "workflows");

describe("production scheduler workflows", () => {
  it("worker-platform-scheduler.yml is a fallback watchdog, not primary 5-minute clock", () => {
    const workflow = readFileSync(
      path.join(WORKFLOW_DIR, "worker-platform-scheduler.yml"),
      "utf8",
    );

    expect(workflow).toContain('cron: "*/30 * * * *"');
    expect(workflow).toContain("environment: production");
    expect(workflow).toContain("/api/workers/fallback-cycle");
    expect(workflow).not.toContain("|| true");
    expect(workflow).toContain("concurrency:");
    expect(workflow).toContain("worker-platform-scheduler");
    expect(workflow).not.toContain("/api/workers/dispatch");
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

  it("vercel.json registers primary worker-cycle cron at launch cadence", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));
    const workerCycle = vercel.crons.find(
      (cron: { path: string }) => cron.path === "/api/cron/worker-cycle",
    );
    expect(workerCycle?.schedule).toBe(LAUNCH_SCHEDULER_CADENCE);
  });
});
