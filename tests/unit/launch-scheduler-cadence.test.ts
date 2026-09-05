import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SCHEDULING_WORDING,
  LAUNCH_SCHEDULER_CADENCE,
  LAUNCH_SCHEDULER_SLA_MINUTES,
  VERCEL_CRON_PATHS,
  VERCEL_PRO_CRON_SCHEDULES,
} from "@/lib/deployment/scheduling";

describe("launch scheduler configuration", () => {
  it("documents Vercel Pro primary cadence and publication SLA", () => {
    expect(LAUNCH_SCHEDULER_CADENCE).toBe("*/5 * * * *");
    expect(VERCEL_PRO_CRON_SCHEDULES.workerCycle).toBe(LAUNCH_SCHEDULER_CADENCE);
    expect(LAUNCH_SCHEDULER_SLA_MINUTES).toBe(10);
    expect(CUSTOMER_SCHEDULING_WORDING).toContain("10 minutes");
  });

  it("vercel.json worker-cycle matches launch cadence", () => {
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    const workerCycle = vercel.crons.find(
      (cron: { path: string }) => cron.path === VERCEL_CRON_PATHS.workerCycle,
    );
    expect(workerCycle?.schedule).toBe(LAUNCH_SCHEDULER_CADENCE);
  });
});
