import { describe, expect, it } from "vitest";
import {
  GSC_QUERY_DEFINITIONS,
  getGscQueryDefinition,
  isAllowedGscQuery,
  validateGscDateRange,
} from "@/lib/gsc/query-registry";

describe("GSC query registry", () => {
  it("rejects arbitrary dimension combinations", () => {
    const result = isAllowedGscQuery(["date", "email"]);
    expect(result.allowed).toBe(false);
  });

  it("allows predefined daily query report", () => {
    const result = isAllowedGscQuery(["date", "query"]);
    expect(result.allowed).toBe(true);
  });

  it("keeps query and page grains separate", () => {
    const queryDef = getGscQueryDefinition("daily_query");
    const pageDef = getGscQueryDefinition("daily_page");
    expect(queryDef?.grain).toBe("query");
    expect(pageDef?.grain).toBe("page");
    expect(queryDef?.dimensions).not.toEqual(pageDef?.dimensions);
  });

  it("rejects oversized date ranges for query-page grain", () => {
    const definition = GSC_QUERY_DEFINITIONS.find((def) => def.key === "daily_query_page")!;
    const range = validateGscDateRange(definition, "2026-01-01", "2026-06-01");
    expect(range.valid).toBe(false);
  });

  it("accepts valid date ranges", () => {
    const definition = GSC_QUERY_DEFINITIONS.find((def) => def.key === "daily_query")!;
    const range = validateGscDateRange(definition, "2026-07-01", "2026-07-15");
    expect(range.valid).toBe(true);
  });
});
