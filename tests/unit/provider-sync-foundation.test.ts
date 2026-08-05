import { beforeEach, describe, expect, it } from "vitest";
import { mapProviderMetrics } from "@/lib/integrations/sync/metric-mapping";
import { validateMetricRecord, computeFreshness, normaliseTimezone } from "@/lib/integrations/sync/data-quality";
import { generateMockSyncPage } from "@/server/providers/sync/mock-sync-adapter";
import { buildFactFingerprint } from "@/lib/analytics-core/deduplication";

describe("provider sync foundation", () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "a".repeat(32);
  });

  it("maps provider metrics to canonical analytics keys", () => {
    const { mapped, unsupported } = mapProviderMetrics({
      impressions: 1000,
      cost_micros: 50,
      unknown_metric: 1,
    });
    expect(mapped.impressions).toBe(1000);
    expect(mapped.spend).toBe(50);
    expect(unsupported).toContain("unknown_metric");
  });

  it("warns on spend without currency", () => {
    const warnings = validateMetricRecord({
      resourceType: "metric_daily",
      externalId: "m1",
      occurredAt: new Date().toISOString(),
      granularity: "DAY",
      metrics: { spend: 10 },
    });
    expect(warnings.some((w) => w.code === "MISSING_CURRENCY")).toBe(true);
  });

  it("paginates mock sync pages", async () => {
    const page1 = generateMockSyncPage({
      providerKey: "google-ads",
      resourceType: "campaign",
      cursor: "0",
    });
    expect(page1.records.length).toBeGreaterThan(0);
    expect(page1.nextCursor).toBe("1");

    const page2 = generateMockSyncPage({
      providerKey: "google-ads",
      resourceType: "campaign",
      cursor: "1",
    });
    expect(page2.nextCursor).toBeUndefined();
  });

  it("deduplicates analytics facts via stable fingerprint", () => {
    const input = {
      organisationId: "org_1",
      metricKey: "impressions",
      occurredAt: "2026-08-01T00:00:00.000Z",
      granularity: "DAY",
      provider: "google-ads",
    };
    const fp1 = buildFactFingerprint(input);
    const fp2 = buildFactFingerprint(input);
    expect(fp1).toBe(fp2);
  });

  it("computes freshness from last sync timestamp", () => {
    const fresh = computeFreshness(new Date());
    expect(fresh.fresh).toBe(true);

    const stale = computeFreshness(new Date(Date.now() - 48 * 60 * 60 * 1000));
    expect(stale.fresh).toBe(false);
  });

  it("normalises invalid timezones to UTC", () => {
    expect(normaliseTimezone("Invalid/Zone")).toBe("UTC");
    expect(normaliseTimezone("America/New_York")).toBe("America/New_York");
  });
});
