import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeDeadlineStatus, isOverdue } from "@/lib/operations/deadlines";

describe("deadline calculations", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("marks completed deadlines as completed", () => {
    expect(
      computeDeadlineStatus(new Date("2026-07-28T12:00:00.000Z"), new Date("2026-07-28T11:00:00.000Z"), now),
    ).toBe("COMPLETED");
  });

  it("marks past due deadlines as overdue", () => {
    expect(computeDeadlineStatus(new Date("2026-07-28T12:00:00.000Z"), null, now)).toBe("OVERDUE");
    expect(isOverdue(new Date("2026-07-28T12:00:00.000Z"), null, now)).toBe(true);
  });

  it("marks near-term deadlines as due soon", () => {
    expect(computeDeadlineStatus(new Date("2026-07-30T12:00:00.000Z"), null, now)).toBe("DUE_SOON");
  });

  it("marks distant deadlines as upcoming", () => {
    expect(computeDeadlineStatus(new Date("2026-08-10T12:00:00.000Z"), null, now)).toBe("UPCOMING");
  });
});
