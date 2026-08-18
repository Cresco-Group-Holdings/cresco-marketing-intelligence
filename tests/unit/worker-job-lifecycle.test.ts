import { describe, expect, it } from "vitest";
import {
  assertWorkerJobTransition,
  canTransitionWorkerJob,
  isExecutableWorkerStatus,
  isTerminalWorkerStatus,
} from "@/lib/workers/lifecycle";

describe("worker job lifecycle", () => {
  it("allows READY to CLAIMED and RUNNING transitions", () => {
    expect(canTransitionWorkerJob("READY", "CLAIMED")).toBe(true);
    expect(() => assertWorkerJobTransition("READY", "CLAIMED")).not.toThrow();
  });

  it("rejects illegal transitions", () => {
    expect(canTransitionWorkerJob("SUCCEEDED", "READY")).toBe(false);
    expect(() => assertWorkerJobTransition("SUCCEEDED", "READY")).toThrow();
  });

  it("classifies executable and terminal states", () => {
    expect(isExecutableWorkerStatus("READY")).toBe(true);
    expect(isExecutableWorkerStatus("RETRY_WAIT")).toBe(true);
    expect(isExecutableWorkerStatus("RUNNING")).toBe(false);
    expect(isTerminalWorkerStatus("DEAD_LETTER")).toBe(true);
    expect(isTerminalWorkerStatus("READY")).toBe(false);
  });

  it("supports retry wait to ready recovery", () => {
    expect(canTransitionWorkerJob("RETRY_WAIT", "READY")).toBe(true);
    expect(canTransitionWorkerJob("RUNNING", "RETRY_WAIT")).toBe(true);
  });
});
