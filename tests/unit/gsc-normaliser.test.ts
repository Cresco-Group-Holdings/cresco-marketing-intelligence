import { describe, expect, it } from "vitest";
import { GscWarehouseNormaliser } from "@/lib/warehouse/transformation/gsc-normaliser";

describe("GSC warehouse normaliser", () => {
  const normaliser = new GscWarehouseNormaliser();

  it("maps GSC metrics to canonical keys", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-1",
        recordType: "gsc_search_analytics_row",
        payload: {
          reportKey: "daily_query",
          grain: "query",
          date: "2026-07-30",
          query: "marketing analytics",
          clicks: 42,
          impressions: 1200,
          ctr: 0.035,
          position: 8.2,
          siteUrl: "https://example.com/",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GOOGLE_SEARCH_CONSOLE",
      },
    );

    expect(result.status).toBe("TRANSFORMED");
    expect(result.metrics.some((m) => m.metricKey === "clicks" && m.metricValue === 42)).toBe(true);
    expect(result.metrics.some((m) => m.metricKey === "avg_position" && m.metricValue === 8.2)).toBe(
      true,
    );
    expect(result.dimensions.some((d) => d.entityType === "search_query")).toBe(true);
  });

  it("keeps query and page dimensions separate", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-2",
        recordType: "gsc_search_analytics_row",
        payload: {
          reportKey: "daily_query_page",
          grain: "query_page",
          date: "2026-07-30",
          query: "pricing",
          page: "https://example.com/pricing",
          clicks: 10,
          impressions: 200,
          ctr: 0.05,
          position: 4.5,
          siteUrl: "https://example.com/",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GOOGLE_SEARCH_CONSOLE",
      },
    );

    expect(result.dimensions.some((d) => d.entityType === "search_query")).toBe(true);
    expect(result.dimensions.some((d) => d.entityType === "landing_page")).toBe(true);
    expect(result.metrics[0]?.grain).toBe("query_page");
  });

  it("marks anonymised query patterns", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "row-3",
        recordType: "gsc_search_analytics_row",
        payload: {
          reportKey: "daily_query",
          grain: "query",
          date: "2026-07-30",
          query: "other",
          clicks: 1,
          impressions: 50,
          ctr: 0.02,
          position: 12,
          siteUrl: "https://example.com/",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GOOGLE_SEARCH_CONSOLE",
      },
    );

    const queryDimension = result.dimensions.find((d) => d.entityType === "search_query");
    expect(queryDimension?.metadata?.isAnonymized).toBe(true);
  });
});
