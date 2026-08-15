import { describe, expect, it } from "vitest";
import { runProviderSyncEngine } from "@/lib/integrations/sync/engine";
import type { SyncPageResult } from "@/lib/integrations/sync/types";

describe("provider sync engine", () => {
  it("processes paginated results and tracks partial failures", async () => {
    const pages: SyncPageResult[] = [
      { records: [{ resourceType: "provider_account", externalId: "a1", name: "A" }], nextCursor: "1" },
      { records: [{ resourceType: "metric_daily", externalId: "m1", occurredAt: new Date().toISOString(), granularity: "DAY", metrics: { impressions: 1 } }], partialFailure: true },
    ];
    let pageIndex = 0;
    const processed: string[] = [];

    const result = await runProviderSyncEngine({
      resourceType: "metric_daily",
      fetchPage: async () => pages[pageIndex++] ?? { records: [] },
      onPage: async (page) => {
        processed.push(...page.records.map((r) => r.externalId));
      },
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.recordsProcessed).toBe(2);
    expect(processed).toEqual(["a1", "m1"]);
  });

  it("records failures without aborting entire sync when page fetch fails once", async () => {
    let calls = 0;
    const failures: string[] = [];

    const result = await runProviderSyncEngine({
      resourceType: "campaign",
      fetchPage: async () => {
        calls += 1;
        if (calls === 1) throw new Error("rate limit");
        return { records: [] };
      },
      onPage: async () => undefined,
      onFailure: async (f) => {
        failures.push(f.error.message);
      },
    });

    expect(result.status).toBe("PARTIAL");
    expect(result.recordsFailed).toBe(1);
    expect(failures[0]).toContain("rate limit");
  });
});
