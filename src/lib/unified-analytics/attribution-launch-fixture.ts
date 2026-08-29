import type { AttributionModelType } from "@prisma/client";
import { buildContentUtm, parseUtmParams, resolveContentLineageKey } from "@/lib/analytics/utm";
import { calculateAttributionCredits } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";
import { classifyChannel } from "@/lib/warehouse/channel-classification";
import { computeAttributionFromJourneys } from "@/lib/unified-analytics/attribution";
import { deduplicateConversions } from "@/lib/unified-analytics/conversion-dedup";
import { resolveRevenueSemantics } from "@/lib/unified-analytics/revenue-semantics";

export type AttributionLaunchTenant = {
  organisationId: string;
  brandId: string;
  projectId: string;
};

export type AttributionLaunchTouchpointInput = {
  channel: string;
  occurredAt: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent?: string;
};

export type AttributionLaunchFixtureInput = {
  tenant: AttributionLaunchTenant;
  contentItemId: string;
  contentVariantId: string;
  campaignLabel: string;
  channelVariant: {
    source: string;
    medium: string;
    contentLabel: string;
  };
  touchpoints: AttributionLaunchTouchpointInput[];
  conversionAt: string;
  revenueValue: number;
  revenueCurrency?: string;
  transactionId: string;
};

export type AttributionLaunchFixture = {
  tenant: AttributionLaunchTenant;
  utm: ReturnType<typeof buildContentUtm>;
  session: {
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
    utmContent: string | null;
    channel: string;
    startedAt: string;
  };
  conversionObservations: ReturnType<typeof deduplicateConversions>;
  canonicalConversion: ReturnType<typeof deduplicateConversions>[number];
  journey: {
    journeyStart: string;
    journeyEnd: string;
    revenueValue: number;
    status: "CONVERTED" | "UNATTRIBUTED";
    touchpoints: Array<{
      id: string;
      occurredAt: string;
      channel: string;
      campaign: string | null;
      contentKey: string | null;
      position: number;
      isExcluded: boolean;
    }>;
  };
  contentLineageKey: string | null;
};

function touchpointInputsFromJourney(
  journey: AttributionLaunchFixture["journey"],
): AttributionTouchpointInput[] {
  return journey.touchpoints.map((touchpoint) => ({
    id: touchpoint.id,
    occurredAt: new Date(touchpoint.occurredAt),
    channel: touchpoint.channel,
    campaign: touchpoint.campaign,
    contentKey: touchpoint.contentKey,
    position: touchpoint.position,
    isExcluded: touchpoint.isExcluded,
  }));
}

/**
 * Production-shaped fixture ingestion for attribution launch validation.
 * Content/Campaign → UTM → session → conversion → revenue → journey (no manual DB edits).
 */
export function ingestAttributionLaunchFixture(
  input: AttributionLaunchFixtureInput,
): AttributionLaunchFixture {
  const utm = buildContentUtm({
    source: input.channelVariant.source,
    medium: input.channelVariant.medium,
    campaignLabel: input.campaignLabel,
    contentLabel: input.channelVariant.contentLabel,
    lineage: {
      contentItemId: input.contentItemId,
      contentVariantId: input.contentVariantId,
      campaignName: input.campaignLabel,
      channel: input.channelVariant.source,
    },
  });

  const lastTouchpoint = input.touchpoints[input.touchpoints.length - 1];
  const isUnattributed = input.touchpoints.length === 0;

  const sessionClassification = isUnattributed
    ? { channel: "DIRECT" }
    : classifyChannel({
        utmSource: lastTouchpoint!.utmSource,
        utmMedium: lastTouchpoint!.utmMedium,
        utmCampaign: lastTouchpoint!.utmCampaign,
        referrer: null,
        provider: "FIRST_PARTY",
      });

  const parsedUtm = isUnattributed
    ? parseUtmParams({})
    : parseUtmParams({
        utm_source: lastTouchpoint!.utmSource,
        utm_medium: lastTouchpoint!.utmMedium,
        utm_campaign: lastTouchpoint!.utmCampaign,
        utm_content: lastTouchpoint!.utmContent,
      });
  const contentLineageKey = resolveContentLineageKey(parsedUtm);

  const conversionObservations = deduplicateConversions([
    {
      id: `${input.tenant.brandId}-provider-conversion`,
      provider: "META",
      conversionType: "purchase",
      occurredAt: input.conversionAt,
      value: input.revenueValue,
      currency: input.revenueCurrency ?? "GBP",
      transactionId: input.transactionId,
    },
    {
      id: `${input.tenant.brandId}-ga4-conversion`,
      provider: "GA4",
      conversionType: "purchase",
      occurredAt: input.conversionAt,
      value: input.revenueValue,
      currency: input.revenueCurrency ?? "GBP",
      transactionId: input.transactionId,
    },
    {
      id: `${input.tenant.brandId}-revenue-source`,
      provider: "STRIPE",
      conversionType: "purchase",
      occurredAt: input.conversionAt,
      value: input.revenueValue,
      currency: input.revenueCurrency ?? "GBP",
      transactionId: input.transactionId,
    },
  ]);

  const canonicalConversion = conversionObservations[0];
  if (!canonicalConversion) {
    throw new Error("Canonical conversion was not produced.");
  }

  const journey = {
    journeyStart: input.touchpoints[0]?.occurredAt ?? input.conversionAt,
    journeyEnd: input.conversionAt,
    revenueValue: input.revenueValue,
    status: input.touchpoints.length > 0 ? ("CONVERTED" as const) : ("UNATTRIBUTED" as const),
    touchpoints: input.touchpoints.map((touchpoint, index) => ({
      id: `${input.tenant.brandId}-tp-${index + 1}`,
      occurredAt: touchpoint.occurredAt,
      channel: touchpoint.channel,
      campaign: touchpoint.utmCampaign,
      contentKey: touchpoint.utmContent ?? contentLineageKey,
      position: index + 1,
      isExcluded: false,
    })),
  };

  return {
    tenant: input.tenant,
    utm,
    session: {
      utmSource: lastTouchpoint?.utmSource ?? "direct",
      utmMedium: lastTouchpoint?.utmMedium ?? "(none)",
      utmCampaign: lastTouchpoint?.utmCampaign ?? "(none)",
      utmContent: lastTouchpoint?.utmContent ?? null,
      channel: sessionClassification.channel,
      startedAt: lastTouchpoint?.occurredAt ?? input.conversionAt,
    },
    conversionObservations,
    canonicalConversion,
    journey,
    contentLineageKey,
  };
}

export function runAttributionModel(
  fixture: AttributionLaunchFixture,
  modelType: AttributionModelType,
  lookbackWindowDays = 90,
) {
  return computeAttributionFromJourneys([fixture.journey], modelType, lookbackWindowDays);
}

export function assertLinearCreditTotals(
  fixture: AttributionLaunchFixture,
  lookbackWindowDays = 90,
  tolerance = 0.01,
) {
  const touchpoints = touchpointInputsFromJourney(fixture.journey);
  const conversionAt = new Date(fixture.journey.journeyEnd);
  const result = calculateAttributionCredits({
    modelType: "LINEAR",
    touchpoints,
    revenueValue: fixture.journey.revenueValue,
    directTrafficPolicy: "RETAIN",
    conversionAt,
  });
  const creditTotal = result.credits.reduce((sum, credit) => sum + (credit.creditValue ?? 0), 0);
  const aggregate = computeAttributionFromJourneys([fixture.journey], "LINEAR", lookbackWindowDays);

  return {
    creditTotal,
    attributedRevenue: aggregate.attributedRevenue,
    withinTolerance: Math.abs(creditTotal - fixture.journey.revenueValue) <= tolerance,
  };
}

export function resolveFixtureRevenueSemantics(
  fixture: AttributionLaunchFixture,
  modelType: AttributionModelType,
  observedRevenue: number,
) {
  const attribution = runAttributionModel(fixture, modelType);
  const attributedRevenue =
    attribution.attributedRevenue > 0 ? attribution.attributedRevenue : null;

  return {
    attribution,
    semantics: resolveRevenueSemantics({
      observedRevenue,
      attributedRevenue,
      channelBreakdown: attribution.channelBreakdown,
    }),
  };
}

export function buildLinkedInMetaLaunchFixture(
  tenant: AttributionLaunchTenant,
  overrides?: Partial<AttributionLaunchFixtureInput>,
): AttributionLaunchFixture {
  return ingestAttributionLaunchFixture({
    tenant,
    contentItemId: "content-launch-1",
    contentVariantId: "variant-linkedin-1",
    campaignLabel: "Q3 Product Launch",
    channelVariant: {
      source: "linkedin",
      medium: "social",
      contentLabel: "Launch Carousel",
    },
    touchpoints: [
      {
        channel: "LinkedIn Ads",
        occurredAt: "2026-01-25T10:00:00.000Z",
        utmSource: "linkedin",
        utmMedium: "paid_social",
        utmCampaign: "q3-product-launch",
        utmContent: "launch-carousel",
      },
      {
        channel: "Meta Ads",
        occurredAt: "2026-01-31T14:00:00.000Z",
        utmSource: "meta",
        utmMedium: "paid_social",
        utmCampaign: "q3-product-launch",
        utmContent: "launch-carousel",
      },
    ],
    conversionAt: "2026-02-01T12:00:00.000Z",
    revenueValue: 1200,
    revenueCurrency: "GBP",
    transactionId: "txn-launch-001",
    ...overrides,
  });
}

export function buildUnattributedRevenueFixture(
  tenant: AttributionLaunchTenant,
  revenueValue = 850,
): AttributionLaunchFixture {
  return ingestAttributionLaunchFixture({
    tenant,
    contentItemId: "content-unattributed",
    contentVariantId: "variant-direct",
    campaignLabel: "Direct",
    channelVariant: {
      source: "direct",
      medium: "none",
      contentLabel: "Direct Visit",
    },
    touchpoints: [],
    conversionAt: "2026-02-02T09:00:00.000Z",
    revenueValue,
    revenueCurrency: "GBP",
    transactionId: "txn-unattributed-001",
  });
}
