import { describe, expect, it } from "vitest";
import {
  analysisRunIdempotencyKey,
  insightIdempotencyKey,
  recommendationIdempotencyKey,
} from "@/lib/growth/idempotency";

describe("growth idempotency keys", () => {
  const from = new Date("2026-07-01T00:00:00.000Z");
  const to = new Date("2026-07-31T23:59:59.999Z");

  it("builds stable analysis run keys", () => {
    const key = analysisRunIdempotencyKey("brand-1", from, to);
    expect(key).toBe("brand-1:2026-07-01T00:00:00.000Z:2026-07-31T23:59:59.999Z");
    expect(analysisRunIdempotencyKey("brand-1", from, to)).toBe(key);
  });

  it("builds per-insight and recommendation keys", () => {
    expect(insightIdempotencyKey("brand-1", from, to, "LOW_ENGAGEMENT")).toContain(
      "LOW_ENGAGEMENT",
    );
    expect(recommendationIdempotencyKey("brand-1", from, to, "LOW_ENGAGEMENT")).toContain(
      ":recommendation",
    );
  });
});
