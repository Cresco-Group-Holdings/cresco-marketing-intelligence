import { describe, expect, it } from "vitest";
import {
  INTERNAL_CRON_JOBS,
  PRODUCTION_TARGET_SCHEDULES,
  VERCEL_HOBBY_CRON_SCHEDULES,
  assertHobbyCompatibleCronSchedule,
  evaluateScheduledExecutionGate,
  isHobbyCompatibleCronSchedule,
} from "@/lib/deployment/scheduling";
import vercelConfig from "../../vercel.json";

describe("deployment scheduling configuration", () => {
  it("documents high-frequency production targets separately from Hobby deployment", () => {
    expect(PRODUCTION_TARGET_SCHEDULES.publishing).toBe("*/5 * * * *");
    expect(VERCEL_HOBBY_CRON_SCHEDULES.dailyDispatch).toBe("0 2 * * *");
    expect(isHobbyCompatibleCronSchedule(PRODUCTION_TARGET_SCHEDULES.publishing)).toBe(false);
    expect(isHobbyCompatibleCronSchedule(VERCEL_HOBBY_CRON_SCHEDULES.dailyDispatch)).toBe(true);
  });

  it("registers only Hobby-compatible schedules in vercel.json", () => {
    for (const cron of vercelConfig.crons) {
      expect(isHobbyCompatibleCronSchedule(cron.schedule)).toBe(true);
    }
    expect(vercelConfig.crons.some((cron) => cron.path === "/api/cron/daily-dispatch")).toBe(true);
    expect(
      vercelConfig.crons.some((cron) => cron.path === "/api/publishing-scheduler/process-due"),
    ).toBe(false);
  });

  it("rejects invalid Hobby cron expressions", () => {
    expect(() => assertHobbyCompatibleCronSchedule("*/5 * * * *", "publishing")).toThrow(
      /Hobby/,
    );
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
