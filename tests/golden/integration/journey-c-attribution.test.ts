/**
 * Journey C — Marketing Touch → Attribution
 */
import { describe, expect, it } from "vitest";
import {
  assertLinearCreditTotals,
  buildLinkedInMetaLaunchFixture,
  buildUnattributedRevenueFixture,
  runAttributionModel,
} from "@/lib/unified-analytics/attribution-launch-fixture";
import { resolveBlendedRoas } from "@/lib/unified-analytics/revenue-semantics";
import { finishJourneyMonitor, resetJourneyMonitor } from "../harness/journey-monitor";

const tenant = {
  organisationId: "org-golden-c",
  brandId: "brand-golden-c",
  projectId: "project-golden-c",
};

describe("Golden Journey C — Marketing Touch → Attribution", () => {
  it("deduplicates multi-source conversion into one canonical revenue event", () => {
    resetJourneyMonitor();
    const fixture = buildLinkedInMetaLaunchFixture(tenant);

    expect(fixture.conversionObservations[0]?.sources).toHaveLength(3);
    expect(fixture.canonicalConversion.value).toBe(1200);
    expect(fixture.journey.touchpoints).toHaveLength(2);

    const lastTouch = runAttributionModel(fixture, "LAST_TOUCH");
    expect(lastTouch.attributedRevenue).toBe(1200);
    expect(lastTouch.channelBreakdown.find((r) => r.channel === "Meta Ads")?.creditValue).toBe(1200);

    const firstTouch = runAttributionModel(fixture, "FIRST_TOUCH");
    expect(firstTouch.channelBreakdown.find((r) => r.channel === "LinkedIn Ads")?.creditValue).toBe(1200);

    const linear = runAttributionModel(fixture, "LINEAR");
    expect(assertLinearCreditTotals(fixture).withinTolerance).toBe(true);
    expect(linear.channelBreakdown.every((r) => r.creditValue === 600)).toBe(true);

    const metrics = finishJourneyMonitor();
    expect(metrics.unexpected5xx).toBe(0);
  });

  it("keeps observed, attributed, and unattributed revenue distinct", () => {
    const unattributed = buildUnattributedRevenueFixture(tenant, 850);
    expect(unattributed.journey.status).toBe("UNATTRIBUTED");

    const roasZero = resolveBlendedRoas(500, 0);
    expect(roasZero).toBe(0);

    const roasUnavailable = resolveBlendedRoas(500, null);
    expect(roasUnavailable).toBeNull();
  });
});
