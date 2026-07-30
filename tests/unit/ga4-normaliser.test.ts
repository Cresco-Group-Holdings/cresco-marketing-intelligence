import { describe, expect, it } from "vitest";
import { Ga4WarehouseNormaliser } from "@/lib/warehouse/transformation/ga4-normaliser";

describe("GA4 warehouse normaliser", () => {
  const normaliser = new Ga4WarehouseNormaliser();

  it("maps GA4 metrics to canonical keys", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-1",
        recordType: "ga4_report_row",
        payload: {
          reportKey: "daily_channel",
          date: "20260730",
          sessionSource: "google",
          sessionMedium: "organic",
          sessions: 120,
          totalUsers: 95,
          screenPageViews: 340,
          propertyId: "123456",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GA4",
      },
    );

    expect(result.status).toBe("TRANSFORMED");
    expect(result.metrics.some((m) => m.metricKey === "sessions" && m.metricValue === 120)).toBe(
      true,
    );
    expect(result.metrics.some((m) => m.metricKey === "pageviews" && m.metricValue === 340)).toBe(
      true,
    );
    expect(result.dimensions.some((d) => d.entityType === "channel")).toBe(true);
  });

  it("only imports metrics present in the row", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-2",
        recordType: "ga4_report_row",
        payload: {
          reportKey: "daily_channel",
          date: "20260730",
          sessions: 10,
          propertyId: "123456",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GA4",
      },
    );

    expect(result.metrics).toHaveLength(1);
    expect(result.metrics[0]?.metricKey).toBe("sessions");
  });
});
