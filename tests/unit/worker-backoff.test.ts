import { afterEach, describe, expect, it } from "vitest";
import { calculateWorkerRetryDelay, nextRetryAt } from "@/lib/workers/backoff";
import { setClockForTests } from "@/lib/workers/clock";

describe("worker backoff", () => {
  afterEach(() => {
    setClockForTests(null);
  });

  it("uses deterministic jitter in tests", () => {
    setClockForTests({
      now: () => new Date("2026-01-15T12:00:00.000Z"),
      random: () => 0.5,
    });

    const delay = calculateWorkerRetryDelay(2, {
      config: {
        maxJobsPerInvocation: 10,
        maxDispatchPerType: 10,
        executionBudgetMs: 10_000,
        leaseDurationMs: 10_000,
        heartbeatIntervalMs: 5_000,
        defaultMaxAttempts: 3,
        retryBaseDelayMs: 1_000,
        retryMaxDelayMs: 60_000,
        retryJitterFactor: 0.2,
        tokenRefreshWindowMs: 3_600_000,
        tokenRefreshBatchLimit: 10,
      },
    });

    expect(delay).toBe(2_200);
    const retry = nextRetryAt(2, new Date("2026-01-15T12:00:00.000Z"), {
      config: {
        maxJobsPerInvocation: 10,
        maxDispatchPerType: 10,
        executionBudgetMs: 10_000,
        leaseDurationMs: 10_000,
        heartbeatIntervalMs: 5_000,
        defaultMaxAttempts: 3,
        retryBaseDelayMs: 1_000,
        retryMaxDelayMs: 60_000,
        retryJitterFactor: 0.2,
        tokenRefreshWindowMs: 3_600_000,
        tokenRefreshBatchLimit: 10,
      },
    });
    expect(retry.toISOString()).toBe("2026-01-15T12:00:02.200Z");
  });

  it("respects provider retry-after ceiling", () => {
    const delay = calculateWorkerRetryDelay(1, { retryAfterMs: 120_000 });
    expect(delay).toBe(120_000);
  });
});
