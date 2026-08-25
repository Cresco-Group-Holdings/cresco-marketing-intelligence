import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrganisationRole } from "@prisma/client";
import {
  assertLinearCreditTotals,
  buildLinkedInMetaLaunchFixture,
  buildUnattributedRevenueFixture,
  ingestAttributionLaunchFixture,
  resolveFixtureRevenueSemantics,
  runAttributionModel,
} from "@/lib/unified-analytics/attribution-launch-fixture";
import { resolveBlendedRoas } from "@/lib/unified-analytics/revenue-semantics";

const prismaMock = vi.hoisted(() => ({
  attributionJourney: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: vi.fn().mockResolvedValue({ id: "brand-a", projectId: "project-a" }),
  },
}));

import { attributionJourneyService } from "@/server/services/attribution-journey-service";

const tenantA = {
  organisationId: "org-a",
  brandId: "brand-a",
  projectId: "project-a",
};

const tenantB = {
  organisationId: "org-b",
  brandId: "brand-b",
  projectId: "project-b",
};

const analystTenant = {
  organisationId: "org-a",
  userProfileId: "user-a",
  userId: "user-a",
  organisationRole: OrganisationRole.ADMIN,
};

describe("attribution launch journey fixture", () => {
  it("ingests content → UTM → session → conversion → revenue → journey without manual DB edits", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);

    expect(fixture.utm.utm_campaign).toBe("q3-product-launch");
    expect(fixture.utm.utm_content).toBe("launch-carousel");
    expect(fixture.session.utmSource).toBe("meta");
    expect(fixture.canonicalConversion.sources).toHaveLength(3);
    expect(fixture.journey.touchpoints).toHaveLength(2);
    expect(fixture.journey.revenueValue).toBe(1200);
  });

  it("awards last-touch credit to Meta", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);
    const result = runAttributionModel(fixture, "LAST_TOUCH");

    expect(result.attributedRevenue).toBe(1200);
    expect(result.channelBreakdown.find((row) => row.channel === "Meta Ads")?.creditValue).toBe(1200);
  });

  it("awards first-touch credit to LinkedIn", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);
    const result = runAttributionModel(fixture, "FIRST_TOUCH");

    expect(result.channelBreakdown.find((row) => row.channel === "LinkedIn Ads")?.creditValue).toBe(1200);
  });

  it("splits linear credit across eligible touchpoints", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);
    const result = runAttributionModel(fixture, "LINEAR");
    const linearTotals = assertLinearCreditTotals(fixture);

    expect(linearTotals.withinTolerance).toBe(true);
    expect(result.channelBreakdown).toHaveLength(2);
    expect(result.channelBreakdown.every((row) => row.creditValue === 600)).toBe(true);
  });

  it("keeps unattributed revenue out of attributed totals", () => {
    const fixture = buildUnattributedRevenueFixture(tenantA, 850);
    const { semantics } = resolveFixtureRevenueSemantics(fixture, "LAST_TOUCH", 850);

    expect(fixture.journey.status).toBe("UNATTRIBUTED");
    expect(semantics.observedRevenue).toBe(850);
    expect(semantics.attributedRevenue).toBeNull();
    expect(semantics.unattributedRevenue).toBe(850);
    expect(semantics.paidAttributedRevenue).toBeNull();
  });

  it("preserves raw conversion observations while deduplicating canonical revenue", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);

    expect(fixture.conversionObservations).toHaveLength(1);
    expect(fixture.conversionObservations[0]?.sources).toHaveLength(3);
    expect(fixture.conversionObservations[0]?.dedupeMethod).toBe("transaction_id");
    expect(fixture.canonicalConversion.value).toBe(1200);
  });

  it("proves content lineage from channel variant utm_content through to attribution", () => {
    const fixture = ingestAttributionLaunchFixture({
      tenant: tenantA,
      contentItemId: "content-42",
      contentVariantId: "variant-instagram-reel",
      campaignLabel: "Spring Drop",
      channelVariant: {
        source: "instagram",
        medium: "social",
        contentLabel: "Spring Reel",
      },
      touchpoints: [
        {
          channel: "Instagram Organic",
          occurredAt: "2026-01-28T10:00:00.000Z",
          utmSource: "instagram",
          utmMedium: "social",
          utmCampaign: "spring-drop",
          utmContent: "spring-reel",
        },
      ],
      conversionAt: "2026-01-29T12:00:00.000Z",
      revenueValue: 499,
      transactionId: "txn-content-lineage",
    });

    expect(fixture.contentLineageKey).toBe("spring-reel");
    expect(fixture.journey.touchpoints[0]?.contentKey).toBe("spring-reel");

    const result = runAttributionModel(fixture, "LAST_TOUCH");
    expect(result.attributedRevenue).toBe(499);
    expect(result.channelBreakdown[0]?.channel).toBe("Instagram Organic");
  });

  it("calculates paid ROAS only from paid-attributable revenue", () => {
    const fixture = buildLinkedInMetaLaunchFixture(tenantA);
    const { semantics } = resolveFixtureRevenueSemantics(fixture, "LAST_TOUCH", 1200);

    expect(semantics.paidAttributedRevenue).toBe(1200);
    expect(resolveBlendedRoas(400, semantics.paidAttributedRevenue)).toBe(3);
    expect(resolveBlendedRoas(400, null)).toBeNull();
  });
});

describe("attribution tenant isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not resolve tenant B journey for tenant A context", async () => {
    prismaMock.attributionJourney.findFirst.mockResolvedValue(null);

    await expect(
      attributionJourneyService.getJourney("brand-a", "org-a", "journey-owned-by-b", analystTenant),
    ).rejects.toThrow("Attribution journey was not found.");

    expect(prismaMock.attributionJourney.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "journey-owned-by-b",
          brandId: "brand-a",
          organisationId: "org-a",
        },
      }),
    );
  });

  it("keeps tenant fixtures isolated by brand and organisation identifiers", () => {
    const fixtureA = buildLinkedInMetaLaunchFixture(tenantA, {
      transactionId: "txn-tenant-a",
    });
    const fixtureB = buildLinkedInMetaLaunchFixture(tenantB, {
      transactionId: "txn-tenant-b",
    });

    expect(fixtureA.tenant.organisationId).not.toBe(fixtureB.tenant.organisationId);
    expect(fixtureA.canonicalConversion.canonicalId).toContain("brand-a");
    expect(fixtureB.canonicalConversion.canonicalId).toContain("brand-b");
    expect(fixtureA.journey.touchpoints[0]?.id).toContain("brand-a");
    expect(fixtureB.journey.touchpoints[0]?.id).toContain("brand-b");
  });
});
