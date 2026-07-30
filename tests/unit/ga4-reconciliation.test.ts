import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    marketingMetricObservation: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { metricValue: 0 } }),
    },
  },
}));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-1", projectId: "proj-1" }),
  },
}));

import { ga4ReconciliationService } from "@/server/services/ga4-reconciliation-service";

describe("GA4 reconciliation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes disclaimer and possible causes", async () => {
    const result = await ga4ReconciliationService.compareSources(
      "brand-1",
      "org-1",
      new Date("2026-07-01"),
      new Date("2026-07-30"),
      {
        userId: "user",
        userProfileId: "profile",
        organisationId: "org-1",
        organisationRole: "OWNER",
      } as never,
    );

    expect(result.disclaimer).toContain("Neither GA4");
    expect(result.possibleCauses.length).toBeGreaterThan(0);
    expect(result.comparison.sessions).toEqual({ ga4: 0, firstParty: 0, delta: 0 });
  });
});
