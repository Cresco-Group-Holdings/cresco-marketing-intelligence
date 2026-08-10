import { describe, expect, it } from "vitest";
import {
  isHobbyCompatibleCronSchedule,
  isVercelCronDispatchEnabled,
  VERCEL_HOBBY_DAILY_CRON_SCHEDULE,
  VERCEL_PRO_PUBLISHING_CRON_SCHEDULE,
} from "@/lib/scheduling/vercel-cron";

describe("vercel cron scheduling", () => {
  it("accepts a once-daily Hobby-compatible schedule", () => {
    expect(isHobbyCompatibleCronSchedule(VERCEL_HOBBY_DAILY_CRON_SCHEDULE)).toBe(true);
    expect(isHobbyCompatibleCronSchedule("30 12 * * *")).toBe(true);
  });

  it("rejects high-frequency schedules incompatible with Vercel Hobby", () => {
    expect(isHobbyCompatibleCronSchedule(VERCEL_PRO_PUBLISHING_CRON_SCHEDULE)).toBe(false);
    expect(isHobbyCompatibleCronSchedule("0 * * * *")).toBe(false);
    expect(isHobbyCompatibleCronSchedule("0 6,18 * * *")).toBe(false);
  });

  it("enables dispatch on production by default", () => {
    expect(isVercelCronDispatchEnabled({ VERCEL_ENV: "production" })).toBe(true);
  });

  it("disables dispatch on preview unless explicitly enabled", () => {
    expect(isVercelCronDispatchEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(
      isVercelCronDispatchEnabled({ VERCEL_ENV: "preview", VERCEL_CRON_ENABLED: "true" }),
    ).toBe(true);
  });

  it("disables dispatch when VERCEL_CRON_ENABLED=false", () => {
    expect(
      isVercelCronDispatchEnabled({ VERCEL_ENV: "production", VERCEL_CRON_ENABLED: "false" }),
    ).toBe(false);
  });
});
