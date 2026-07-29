import { describe, expect, it } from "vitest";
import {
  classifyRetryError,
  exponentialBackoffMs,
  nextRetryDate,
  shouldMoveToDeadLetter,
} from "@/lib/notifications/retry-governance";

describe("retry governance", () => {
  it("classifies terminal provider errors", () => {
    const result = classifyRetryError("PERMISSION_MISSING", "Missing publish permission");
    expect(result.terminal).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it("classifies retryable provider errors", () => {
    const result = classifyRetryError("RATE_LIMITED", "Too many requests");
    expect(result.retryable).toBe(true);
    expect(result.terminal).toBe(false);
  });

  it("moves jobs to dead letter after max attempts", () => {
    expect(shouldMoveToDeadLetter(3, 3)).toBe(true);
    expect(shouldMoveToDeadLetter(2, 3)).toBe(false);
  });

  it("applies exponential backoff", () => {
    expect(exponentialBackoffMs(1)).toBe(10_000);
    expect(exponentialBackoffMs(4)).toBe(80_000);
    const retryAt = nextRetryDate(2, new Date("2026-07-29T00:00:00.000Z"));
    expect(retryAt.getTime()).toBe(new Date("2026-07-29T00:00:20.000Z").getTime());
  });
});
