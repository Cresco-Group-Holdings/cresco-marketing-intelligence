import { prisma } from "@/lib/database/prisma";
import {
  ATTRIBUTION_DISCLAIMER,
  ATTRIBUTION_MODEL_LABELS,
  DIRECT_TRAFFIC_POLICY_LABELS,
} from "@/lib/attribution/constants";
import { applyShowBothVariants } from "@/lib/attribution/direct-traffic";
import { calculateAttributionCredits, filterTouchpointsByLookback } from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { attributionModelService } from "@/server/services/attribution-model-service";
import { brandService } from "@/server/services/workspace-service";

type ChannelAggregate = {
  channel: string;
  creditPercent: number;
  creditValue: number;
  conversions: number;
};

function aggregateByChannel(
  credits: Array<{
    channel: string | null;
    creditPercent: unknown;
    creditValue: unknown;
    wasExcluded: boolean;
  }>,
): ChannelAggregate[] {
  const map = new Map<string, ChannelAggregate>();

  for (const credit of credits) {
    if (credit.wasExcluded) continue;
    const channel = credit.channel ?? "Unknown";
    const existing = map.get(channel) ?? {
      channel,
      creditPercent: 0,
      creditValue: 0,
      conversions: 0,
    };
    existing.creditPercent += Number(credit.creditPercent);
    existing.creditValue += Number(credit.creditValue ?? 0);
    existing.conversions += 1;
    map.set(channel, existing);
  }

  return Array.from(map.values()).sort((a, b) => b.creditValue - a.creditValue);
}

export const attributionDashboardService = {
  async getOverview(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    await attributionModelService.ensureDefaultModels(brandId, organisationId, context);

    const results = await prisma.attributionResult.findMany({
      where: { brandId, organisationId, calculatedAt: { gte: from, lte: to } },
      include: {
        credits: true,
        attributionModel: true,
        attributionJourney: true,
      },
    });

    const attributedConversions = results.filter((r) => Number(r.totalCreditPercent) > 0).length;
    const attributedRevenue = results.reduce((sum, r) => sum + Number(r.revenueValue), 0);
    const channelBreakdown = aggregateByChannel(results.flatMap((r) => r.credits));

    const unattributed = await prisma.attributionJourney.count({
      where: {
        brandId,
        organisationId,
        status: "UNATTRIBUTED",
        journeyEnd: { gte: from, lte: to },
      },
    });

    const defaultModel = await prisma.attributionModel.findFirst({
      where: { brandId, organisationId, isDefault: true },
    });

    return {
      attributedConversions,
      attributedRevenue,
      channelBreakdown,
      unattributedConversions: unattributed,
      disclaimer: ATTRIBUTION_DISCLAIMER,
      directTrafficPolicy: defaultModel
        ? DIRECT_TRAFFIC_POLICY_LABELS[defaultModel.directTrafficPolicy]
        : null,
      limitations: [
        "Cross-device journeys may be incomplete.",
        "Model choice affects credit assignment — no single model is universally correct.",
      ],
    };
  },

  async getJourneys(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const journeys = await prisma.attributionJourney.findMany({
      where: { brandId, organisationId, journeyEnd: { gte: from, lte: to } },
      include: {
        touchpoints: { orderBy: { position: "asc" } },
        identity: true,
        results: {
          include: { attributionModel: true, credits: true },
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { journeyEnd: "desc" },
      take: 50,
    });

    return journeys.map((journey) => ({
      id: journey.id,
      conversionType: journey.conversionType,
      status: journey.status,
      journeyStart: journey.journeyStart.toISOString(),
      journeyEnd: journey.journeyEnd?.toISOString() ?? null,
      revenueValue: Number(journey.revenueValue ?? 0),
      revenueCurrency: journey.revenueCurrency,
      identityId: journey.identityId,
      identityValue: journey.identity?.identityValue ?? null,
      touchpointCount: journey.touchpoints.length,
      touchpoints: journey.touchpoints.map((tp) => ({
        id: tp.id,
        source: tp.touchpointSource,
        channel: tp.channel,
        campaign: tp.campaign,
        contentKey: tp.contentKey,
        occurredAt: tp.occurredAt.toISOString(),
        position: tp.position,
        isExcluded: tp.isExcluded,
      })),
      latestResult: journey.results[0]
        ? {
            model: journey.results[0].attributionModel.name,
            totalCreditPercent: Number(journey.results[0].totalCreditPercent),
          }
        : null,
      limitations: journey.limitations,
      directTrafficPolicy: DIRECT_TRAFFIC_POLICY_LABELS[journey.directTrafficPolicy],
    }));
  },

  async getConversions(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const results = await prisma.attributionResult.findMany({
      where: { brandId, organisationId, calculatedAt: { gte: from, lte: to } },
      include: {
        attributionJourney: true,
        attributionModel: true,
        attributionModelVersion: true,
        credits: { include: { attributionTouchpoint: true } },
      },
      orderBy: { calculatedAt: "desc" },
      take: 100,
    });

    return results.map((result) => ({
      id: result.id,
      conversionType: result.attributionJourney.conversionType,
      revenueValue: Number(result.revenueValue),
      revenueCurrency: result.revenueCurrency,
      model: result.attributionModel.name,
      modelType: result.attributionModel.modelType,
      modelVersion: result.attributionModelVersion.versionNumber,
      totalCreditPercent: Number(result.totalCreditPercent),
      calculatedAt: result.calculatedAt.toISOString(),
      credits: result.credits
        .filter((c) => !c.wasExcluded)
        .map((c) => ({
          channel: c.channel,
          campaign: c.campaign,
          contentKey: c.contentKey,
          creditPercent: Number(c.creditPercent),
          creditValue: Number(c.creditValue ?? 0),
          position: c.position,
        })),
      excludedCredits: result.credits
        .filter((c) => c.wasExcluded)
        .map((c) => ({
          channel: c.channel,
          reason: (c.metadata as { reason?: string })?.reason,
        })),
      limitations: result.limitations,
      directTrafficPolicy: (result.metadata as { directTrafficPolicy?: string })?.directTrafficPolicy,
    }));
  },

  async compareModels(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    modelIds: string[],
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    const models = await prisma.attributionModel.findMany({
      where: { brandId, organisationId, id: { in: modelIds } },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
    });

    const journeys = await prisma.attributionJourney.findMany({
      where: {
        brandId,
        organisationId,
        journeyEnd: { gte: from, lte: to },
        status: { in: ["CONVERTED", "UNATTRIBUTED"] },
      },
      include: { touchpoints: { orderBy: { position: "asc" } } },
      take: 50,
    });

    const comparison = models.map((model) => {
      const version = model.versions[0];
      if (!version) return { modelId: model.id, modelName: model.name, channelBreakdown: [] };

      const allCredits: Array<{ channel: string | null; creditPercent: number; creditValue: number; wasExcluded: boolean }> = [];

      for (const journey of journeys) {
        const conversionAt = journey.journeyEnd ?? journey.journeyStart;
        const revenueValue = Number(journey.revenueValue ?? 0);
        const touchpoints: AttributionTouchpointInput[] = journey.touchpoints.map((tp) => ({
          id: tp.id,
          occurredAt: tp.occurredAt,
          channel: tp.channel,
          campaign: tp.campaign,
          contentKey: tp.contentKey,
          position: tp.position ?? undefined,
          isDirect: tp.channel?.toUpperCase() === "DIRECT",
          isExcluded: tp.isExcluded,
        }));

        const { included } = filterTouchpointsByLookback(touchpoints, conversionAt, journey.lookbackWindowDays);
        const calculation = calculateAttributionCredits({
          modelType: version.modelType,
          touchpoints: included,
          revenueValue,
          directTrafficPolicy: journey.directTrafficPolicy,
          config: version.config as Record<string, unknown> | null,
          conversionAt,
        });

        for (const credit of calculation.credits) {
          allCredits.push({
            channel: credit.channel ?? null,
            creditPercent: credit.creditPercent,
            creditValue: credit.creditValue ?? 0,
            wasExcluded: false,
          });
        }
      }

      return {
        modelId: model.id,
        modelName: model.name,
        modelType: model.modelType,
        modelLabel: ATTRIBUTION_MODEL_LABELS[model.modelType],
        directTrafficPolicy: DIRECT_TRAFFIC_POLICY_LABELS[model.directTrafficPolicy],
        channelBreakdown: aggregateByChannel(allCredits),
        totalRevenue: allCredits.reduce((sum, c) => sum + c.creditValue, 0),
      };
    });

    return {
      models: comparison,
      disclaimer:
        "Model comparison shows how credit shifts between analytical models. No model is labelled as universally correct.",
      showBothNote:
        models.some((m) => m.directTrafficPolicy === "SHOW_BOTH")
          ? "Some models use SHOW_BOTH direct traffic policy — compare view uses retain variant."
          : null,
    };
  },

  async getModels(brandId: string, organisationId: string, context: TenantContext) {
    const models = await attributionModelService.listModels(brandId, organisationId, context);
    return models.map((model) => ({
      id: model.id,
      name: model.name,
      modelType: model.modelType,
      modelLabel: ATTRIBUTION_MODEL_LABELS[model.modelType],
      directTrafficPolicy: model.directTrafficPolicy,
      directTrafficPolicyLabel: DIRECT_TRAFFIC_POLICY_LABELS[model.directTrafficPolicy],
      lookbackWindowDays: model.lookbackWindowDays,
      isDefault: model.isDefault,
      currentVersion: model.versions[0]?.versionNumber ?? null,
      versions: model.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        createdAt: v.createdAt.toISOString(),
        changelog: v.changelog,
      })),
    }));
  },

  async getWarnings(brandId: string, organisationId: string, from: Date, to: Date, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);

    const unattributed = await prisma.attributionJourney.count({
      where: { brandId, organisationId, status: "UNATTRIBUTED", journeyEnd: { gte: from, lte: to } },
    });
    const missingIdentity = await prisma.attributionJourney.count({
      where: { brandId, organisationId, identityId: null, journeyEnd: { gte: from, lte: to } },
    });
    const refunded = await prisma.attributionJourney.count({
      where: { brandId, organisationId, status: "REFUNDED", journeyEnd: { gte: from, lte: to } },
    });

    return {
      warnings: [
        ...(unattributed > 0
          ? [{ level: "info", message: `${unattributed} conversions could not be attributed.` }]
          : []),
        ...(missingIdentity > 0
          ? [{ level: "warning", message: `${missingIdentity} journeys lack identity linkage.` }]
          : []),
        ...(refunded > 0
          ? [{ level: "info", message: `${refunded} refunded conversions — reprocess to update credits.` }]
          : []),
        { level: "info", message: ATTRIBUTION_DISCLAIMER },
      ],
      dataLimitations: [
        "Cross-device identity linking is limited.",
        "Consent restrictions may exclude touchpoints.",
        "Late-arriving events may require reprocessing.",
      ],
    };
  },

  getShowBothPreview(touchpoints: AttributionTouchpointInput[]) {
    return applyShowBothVariants(touchpoints);
  },
};
