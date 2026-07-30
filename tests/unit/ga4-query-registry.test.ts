import { describe, expect, it } from "vitest";
import {
  assertValidGa4Query,
  isAllowedGa4Query,
  validateGa4DateRange,
} from "@/lib/ga4/query-registry";

describe("GA4 query registry", () => {
  it("rejects arbitrary dimension combinations", () => {
    const result = isAllowedGa4Query(["date", "email"], ["sessions"]);
    expect(result.allowed).toBe(false);
  });

  it("allows predefined daily channel report", () => {
    const definition = assertValidGa4Query("daily_channel", "2026-07-01", "2026-07-07");
    const result = isAllowedGa4Query(definition.dimensions, definition.metrics);
    expect(result.allowed).toBe(true);
  });

  it("rejects oversized date ranges", () => {
    const definition = assertValidGa4Query("daily_page_path", "2026-07-01", "2026-07-07");
    const range = validateGa4DateRange(definition, "2026-01-01", "2026-03-01");
    expect(range.valid).toBe(false);
  });

  it("accepts valid date ranges", () => {
    const definition = assertValidGa4Query("daily_channel", "2026-07-01", "2026-07-15");
    const range = validateGa4DateRange(definition, "2026-07-01", "2026-07-15");
    expect(range.valid).toBe(true);
  });
});
