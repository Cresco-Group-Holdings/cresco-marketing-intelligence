import { describe, expect, it } from "vitest";
import {
  assertAllowlisted,
  assertAllowlistedList,
  METRIC_GROUP_BY_ALLOWLIST,
  METRIC_SORT_ALLOWLIST,
} from "@/lib/warehouse/query-allowlist";

describe("warehouse query allowlists", () => {
  it("accepts allowlisted group-by fields", () => {
    expect(assertAllowlisted("metricKey", METRIC_GROUP_BY_ALLOWLIST, "groupBy")).toBe("metricKey");
    expect(assertAllowlisted(undefined, METRIC_GROUP_BY_ALLOWLIST, "groupBy")).toBeUndefined();
  });

  it("rejects arbitrary group-by fields", () => {
    expect(() => assertAllowlisted("DROP TABLE", METRIC_GROUP_BY_ALLOWLIST, "groupBy")).toThrow(
      /Invalid groupBy/,
    );
  });

  it("validates each entry in a group-by list", () => {
    expect(
      assertAllowlistedList(["metricKey", "provider"], METRIC_GROUP_BY_ALLOWLIST, "groupBy"),
    ).toEqual(["metricKey", "provider"]);
    expect(() =>
      assertAllowlistedList(["metricKey", "rawPayload"], METRIC_GROUP_BY_ALLOWLIST, "groupBy"),
    ).toThrow(/Invalid groupBy/);
  });

  it("accepts allowlisted sort fields", () => {
    expect(assertAllowlisted("observedAt", METRIC_SORT_ALLOWLIST, "sortBy")).toBe("observedAt");
  });
});
