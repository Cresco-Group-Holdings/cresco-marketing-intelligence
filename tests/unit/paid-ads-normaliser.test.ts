import { describe, expect, it } from "vitest";
import { getPaidAdsNormaliser } from "@/lib/warehouse/transformation/paid-ads-normaliser";

describe("paid ads warehouse normaliser", () => {
  const normaliser = getPaidAdsNormaliser("GOOGLE_ADS");

  it("maps campaign hierarchy dimensions", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "campaign-1",
        recordType: "paid_ads_campaign",
        payload: {
          campaignId: "123",
          accountId: "acc-1",
          name: "Brand Search",
          status: "ACTIVE",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GOOGLE_ADS",
      },
    );

    expect(result.status).toBe("TRANSFORMED");
    expect(result.dimensions.some((d) => d.entityType === "campaign")).toBe(true);
    expect(result.dimensions.some((d) => d.entityType === "account")).toBe(true);
  });

  it("preserves attribution window in metric dimensions", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "metrics-1",
        recordType: "paid_ads_metrics_row",
        payload: {
          date: "2026-07-30",
          accountId: "acc-1",
          metrics: { impressions: 1000, clicks: 50, cost: 120 },
          attributionWindow: "30d_click",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "GOOGLE_ADS",
      },
    );

    expect(result.metrics.some((m) => m.metricKey === "impressions")).toBe(true);
    expect(result.metrics[0]?.dimensions?.attributionWindow).toBe("30d_click");
  });

  it("creates cost records with currency isolation", async () => {
    const result = await normaliser.normalise(
      {
        providerRecordId: "spend-1",
        recordType: "paid_ads_spend_row",
        payload: {
          date: "2026-07-30",
          accountId: "acc-1",
          amount: 250.5,
          currency: "GBP",
        },
      },
      {
        organisationId: "org-1",
        projectId: "proj-1",
        brandId: "brand-1",
        marketingDataSourceAccountId: "acct-1",
        provider: "META",
      },
    );

    expect(result.costRecords?.[0]?.currency).toBe("GBP");
    expect(result.costRecords?.[0]?.amount).toBe(250.5);
  });
});
