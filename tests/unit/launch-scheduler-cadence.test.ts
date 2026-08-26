import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAUNCH_SCHEDULER_CADENCE, LAUNCH_SCHEDULER_SLA_MINUTES } from "@/lib/deployment/scheduling";

describe("launch scheduler configuration", () => {
  it("documents 5-minute GitHub Actions cadence and SLA tolerance", () => {
    expect(LAUNCH_SCHEDULER_CADENCE).toBe("*/5 * * * *");
    expect(LAUNCH_SCHEDULER_SLA_MINUTES).toBe(10);
  });

  it("worker-platform workflow matches launch cadence", () => {
    const workflow = readFileSync(".github/workflows/worker-platform-scheduler.yml", "utf8");
    expect(workflow).toContain(LAUNCH_SCHEDULER_CADENCE);
  });
});
