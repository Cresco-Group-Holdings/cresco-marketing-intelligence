import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isHobbyCompatibleCronSchedule } from "@/lib/scheduling/vercel-cron";

const WORKFLOW_DIR = path.join(process.cwd(), ".github", "workflows");
const VERCEL_JSON_PATH = path.join(process.cwd(), "vercel.json");

describe("production scheduler workflows", () => {
  it("vercel.json registers only Hobby-compatible cron schedules", () => {
    const vercelJson = JSON.parse(readFileSync(VERCEL_JSON_PATH, "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>;
    };

    expect(vercelJson.crons?.length).toBeGreaterThan(0);
    for (const cron of vercelJson.crons ?? []) {
      expect(isHobbyCompatibleCronSchedule(cron.schedule)).toBe(true);
    }
    expect(vercelJson.crons?.some((cron) => cron.path === "/api/cron/daily")).toBe(true);
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
