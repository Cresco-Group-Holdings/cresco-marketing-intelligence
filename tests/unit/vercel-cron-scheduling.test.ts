import { describe, expect, it } from "vitest";
import {
  CUSTOMER_SCHEDULING_WORDING,
  INTERNAL_CRON_JOBS,
  LAUNCH_SCHEDULER_CADENCE,
  LAUNCH_SCHEDULER_SLA_MINUTES,
  PRODUCTION_TARGET_SCHEDULES,
  VERCEL_CRON_PATHS,
  VERCEL_HOBBY_CRON_SCHEDULES,
  VERCEL_PRO_CRON_SCHEDULES,
  assertHobbyCompatibleCronSchedule,
  evaluateScheduledExecutionGate,
  isAllowedVercelCronSchedule,
  isHobbyCompatibleCronSchedule,
  isProCronSchedule,
} from "@/lib/deployment/scheduling";
import vercelConfig from "../../vercel.json";

describe("deployment scheduling configuration", () => {
  it("documents Vercel Pro primary scheduler and Hobby daily fallback", () => {
    expect(PRODUCTION_TARGET_SCHEDULES.publishing).toBe("*/5 * * * *");
    expect(VERCEL_PRO_CRON_SCHEDULES.workerCycle).toBe(LAUNCH_SCHEDULER_CADENCE);
    expect(VERCEL_HOBBY_CRON_SCHEDULES.dailyDispatch).toBe("0 2 * * *");
    expect(isProCronSchedule(LAUNCH_SCHEDULER_CADENCE)).toBe(true);
    expect(isHobbyCompatibleCronSchedule(PRODUCTION_TARGET_SCHEDULES.publishing)).toBe(false);
    expect(isHobbyCompatibleCronSchedule(VERCEL_HOBBY_CRON_SCHEDULES.dailyDispatch)).toBe(true);
    expect(LAUNCH_SCHEDULER_SLA_MINUTES).toBe(10);
    expect(CUSTOMER_SCHEDULING_WORDING).toMatch(/10 minutes/i);
  });

  it("registers Pro worker-cycle and Hobby daily dispatch in vercel.json", () => {
    const workerCycle = vercelConfig.crons.find(
      (cron) => cron.path === VERCEL_CRON_PATHS.workerCycle,
    );
    const dailyDispatch = vercelConfig.crons.find(
      (cron) => cron.path === VERCEL_CRON_PATHS.dailyDispatch,
    );
    expect(workerCycle?.schedule).toBe(LAUNCH_SCHEDULER_CADENCE);
    expect(dailyDispatch?.schedule).toBe(VERCEL_HOBBY_CRON_SCHEDULES.dailyDispatch);
    for (const cron of vercelConfig.crons) {
      expect(isAllowedVercelCronSchedule(cron.path, cron.schedule)).toBe(true);
    }
    expect(
      vercelConfig.crons.some((cron) => cron.path === "/api/publishing-scheduler/process-due"),
    ).toBe(false);
  });

  it("rejects invalid Hobby cron expressions", () => {
    expect(() => assertHobbyCompatibleCronSchedule("*/5 * * * *", "publishing")).toThrow(/Hobby/);
  });

  it("blocks preview scheduled execution by default", () => {
    const original = { ...process.env };
    process.env.VERCEL_ENV = "preview";
    delete process.env.CRON_ALLOW_PREVIEW;
    expect(evaluateScheduledExecutionGate().allowed).toBe(false);
    process.env = original;
  });

  it("defines internal publishing job with bounded daily passes", () => {
    expect(INTERNAL_CRON_JOBS.publishing.maxPassesPerDailyDispatch).toBeGreaterThan(0);
    expect(INTERNAL_CRON_JOBS.publishing.targetSchedule).toBe(PRODUCTION_TARGET_SCHEDULES.publishing);
  });
});
