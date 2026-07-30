import { describe, expect, it } from "vitest";
import { getStubNormaliser, supportsStubNormaliser } from "@/lib/warehouse/transformation/stub-adapter";

describe("warehouse stub normaliser", () => {
  const context = {
    organisationId: "org-1",
    projectId: "project-1",
    brandId: "brand-1",
    marketingDataSourceAccountId: "account-1",
    provider: "MANUAL_IMPORT" as const,
    batchId: "batch-1",
  };

  it("supports manual import and first-party providers only", () => {
    expect(supportsStubNormaliser("MANUAL_IMPORT")).toBe(true);
    expect(supportsStubNormaliser("FIRST_PARTY")).toBe(true);
    expect(supportsStubNormaliser("GA4")).toBe(false);
  });

  it("normalises numeric payload fields into metric observations", async () => {
    const normaliser = getStubNormaliser("MANUAL_IMPORT");
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-1",
        recordType: "metric",
        eventTime: new Date("2026-07-30T00:00:00Z"),
        payload: { clicks: "42", source: "summer" },
      },
      context,
    );

    expect(result.status).toBe("TRANSFORMED");
    expect(result.metrics).toEqual([
      expect.objectContaining({ metricKey: "clicks", metricValue: 42 }),
    ]);
    expect(result.dimensions[0]).toEqual(
      expect.objectContaining({ entityType: "channel", name: "summer" }),
    );
  });

  it("rejects payloads without normalisable metrics or events", async () => {
    const normaliser = getStubNormaliser("MANUAL_IMPORT");
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-2",
        recordType: "metric",
        payload: { campaign: "summer" },
      },
      context,
    );

    expect(result.status).toBe("REJECTED");
    expect(result.errors?.[0]).toMatch(/No normalisable metrics/);
  });
});
