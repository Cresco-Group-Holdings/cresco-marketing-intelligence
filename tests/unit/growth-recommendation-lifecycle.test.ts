import { describe, expect, it } from "vitest";
import {
  assertFeedbackTransition,
  isDuplicateFeedback,
  requiresMeasuredOutcome,
} from "@/lib/growth/recommendation-lifecycle";
import { AppError } from "@/lib/errors";

describe("recommendation lifecycle", () => {
  it("allows initial feedback states", () => {
    expect(() => assertFeedbackTransition(null, "ACCEPTED")).not.toThrow();
    expect(() => assertFeedbackTransition(null, "PLANNED")).not.toThrow();
    expect(() => assertFeedbackTransition(null, "DISMISSED")).not.toThrow();
  });

  it("rejects invalid transitions and duplicate feedback", () => {
    expect(() => assertFeedbackTransition("DISMISSED", "ACCEPTED")).toThrow(AppError);
    expect(isDuplicateFeedback("ACCEPTED", "ACCEPTED")).toBe(true);
    expect(requiresMeasuredOutcome("SUCCESSFUL")).toBe(true);
  });

  it("supports implemented to outcome transitions", () => {
    expect(() => assertFeedbackTransition("IMPLEMENTED", "SUCCESSFUL")).not.toThrow();
    expect(() => assertFeedbackTransition("IMPLEMENTED", "INCONCLUSIVE")).not.toThrow();
  });
});
