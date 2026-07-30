import { createHash } from "node:crypto";
import type { AttributionRunTrigger, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { ATTRIBUTION_DISCLAIMER } from "@/lib/attribution/constants";
import {
  calculateAttributionCredits,
  filterTouchpointsByLookback,
} from "@/lib/attribution/models";
import type { AttributionTouchpointInput } from "@/lib/attribution/types";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { attributionJourneyService } from "@/server/services/attribution-journey-service";
import { attributionModelService } from "@/server/services/attribution-model-service";
import { brandService } from "@/server/services/workspace-service";

function touchpointToInput(
  tp: {
    id: string;
    occurredAt: Date;
    channel: string | null;
    campaign: string | null;
    contentKey: string | null;
    position: number | null;
    isExcluded: boolean;
    exclusionReason: string | null;
  },
): AttributionTouchpointInput {
  const channel = tp.channel?.toUpperCase() ?? "";
  return {
    id: tp.id,
    occurredAt: tp.occurredAt,
    channel: tp.channel,
    campaign: tp.campaign,
    contentKey: tp.contentKey,
    position: tp.position ?? undefined,
    isDirect: channel === "DIRECT" || channel === "(NONE)",
    isExcluded: tp.isExcluded,
    exclusionReason: tp.exclusionReason,
  };
}

async function applyExclusionRules(
  brandId: string,
  organisationId: string,
  touchpoints: AttributionTouchpointInput[],
) {
  const rules = await prisma.attributionExclusionRule.findMany({
    where: { brandId, organisationId, isActive: true },
  });

  const excluded: AttributionTouchpointInput[] = [];
  const included: AttributionTouchpointInput[] = [];

  for (const tp of touchpoints) {
    let excludedByRule = false;
    for (const rule of rules) {
      const fieldValue = (() => {
        switch (rule.matchField) {
          case "channel":
            return tp.channel;
          case "campaign":
            return tp.campaign;
          case "contentKey":
            return tp.contentKey;
          default:
            return null;
        }
      })();

      if (fieldValue && fieldValue.toLowerCase() === rule.matchValue.toLowerCase()) {
        excluded.push({
          ...tp,
          isExcluded: true,
          exclusionReason: rule.reason ?? `exclusion_rule:${rule.name}`,
        });
        excludedByRule = true;
        break;
      }
    }
    if (!excludedByRule) included.push(tp);
  }

  return { included, excluded };
}

export const attributionEngineService = {
  buildIdempotencyKey(parts: string[]) {
    return createHash("sha256").update(parts.join(":")).digest("hex");
  },

  async runAttribution(
    brandId: string,
    organisationId: string,
    input: {
      modelId?: string;
      triggerReason: AttributionRunTrigger;
      from: Date;
      to: Date;
      journeyIds?: string[];
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    await attributionModelService.ensureDefaultModels(brandId, organisationId, context);

    const model = input.modelId
      ? await attributionModelService.getModel(brandId, organisationId, input.modelId, context)
      : (await attributionModelService.listModels(brandId, organisationId, context)).find((m) => m.isDefault) ??
        (await attributionModelService.listModels(brandId, organisationId, context))[0];

    if (!model) throw new AppError("NOT_FOUND", "No attribution model available.");

    const version = model.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "Attribution model has no version.");

    const idempotencyKey = this.buildIdempotencyKey([
      brandId,
      model.id,
      version.id,
      input.triggerReason,
      input.from.toISOString(),
      input.to.toISOString(),
    ]);

    const existingRun = await prisma.attributionRun.findUnique({ where: { idempotencyKey } });
    if (existingRun?.status === "COMPLETED") return existingRun;

    const run = await prisma.attributionRun.upsert({
      where: { idempotencyKey },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        attributionModelId: model.id,
        attributionModelVersionId: version.id,
        status: "RUNNING",
        triggerReason: input.triggerReason,
        startedAt: new Date(),
        idempotencyKey,
      },
      update: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
    });

    try {
      await attributionJourneyService.syncJourneysFromConversions(
        brandId,
        organisationId,
        input.from,
        input.to,
        version.lookbackWindowDays,
        version.directTrafficPolicy,
        context,
      );

      const journeys = input.journeyIds?.length
        ? await prisma.attributionJourney.findMany({
            where: { brandId, organisationId, id: { in: input.journeyIds } },
            include: { touchpoints: { orderBy: { position: "asc" } } },
          })
        : await prisma.attributionJourney.findMany({
            where: {
              brandId,
              organisationId,
              journeyEnd: { gte: input.from, lte: input.to },
              status: { in: ["CONVERTED", "UNATTRIBUTED"] },
            },
            include: { touchpoints: { orderBy: { position: "asc" } } },
          });

      let resultsCreated = 0;

      for (const journey of journeys) {
        const conversionAt = journey.journeyEnd ?? journey.journeyStart;
        const revenueValue = Number(journey.revenueValue ?? 0);

        const lookbackFiltered = filterTouchpointsByLookback(
          journey.touchpoints.map(touchpointToInput),
          conversionAt,
          journey.lookbackWindowDays,
        );

        const exclusionFiltered = await applyExclusionRules(
          brandId,
          organisationId,
          lookbackFiltered.included,
        );

        const allExcluded = [
          ...lookbackFiltered.excluded,
          ...exclusionFiltered.excluded,
        ];

        const calculation = calculateAttributionCredits({
          modelType: version.modelType,
          touchpoints: exclusionFiltered.included,
          revenueValue,
          directTrafficPolicy: journey.directTrafficPolicy,
          config: version.config as Record<string, unknown> | null,
          conversionAt,
        });

        const limitations = [
          ATTRIBUTION_DISCLAIMER,
          ...(Array.isArray((journey.limitations as { messages?: string[] })?.messages)
            ? (journey.limitations as { messages: string[] }).messages
            : []),
          ...calculation.limitations,
        ];

        const result = await prisma.attributionResult.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            attributionJourneyId: journey.id,
            attributionModelId: model.id,
            attributionModelVersionId: version.id,
            attributionRunId: run.id,
            conversionEventId: journey.conversionEventId,
            revenueValue,
            revenueCurrency: journey.revenueCurrency,
            totalCreditPercent: calculation.totalCreditPercent,
            calculatedAt: new Date(),
            limitations: { messages: limitations },
            metadata: {
              directTrafficVariant: calculation.directTrafficVariant,
              directTrafficPolicy: journey.directTrafficPolicy,
            },
          },
        });

        for (const credit of calculation.credits) {
          await prisma.attributionCredit.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId,
              attributionResultId: result.id,
              attributionTouchpointId: credit.touchpointId,
              creditPercent: credit.creditPercent,
              creditValue: credit.creditValue,
              channel: credit.channel,
              campaign: credit.campaign,
              contentKey: credit.contentKey,
              position: credit.position,
            },
          });
        }

        for (const excluded of allExcluded) {
          if (!excluded.id) continue;
          const existing = journey.touchpoints.find((tp) => tp.id === excluded.id);
          if (!existing) continue;
          await prisma.attributionCredit.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId,
              attributionResultId: result.id,
              attributionTouchpointId: excluded.id,
              creditPercent: 0,
              creditValue: 0,
              channel: excluded.channel,
              campaign: excluded.campaign,
              contentKey: excluded.contentKey,
              position: excluded.position,
              wasExcluded: true,
              metadata: { reason: excluded.exclusionReason } as Prisma.InputJsonValue,
            },
          });
        }

        resultsCreated += 1;
      }

      return prisma.attributionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          journeysProcessed: journeys.length,
          resultsCreated,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await prisma.attributionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Attribution run failed.",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  },

  async reprocess(
    brandId: string,
    organisationId: string,
    triggerReason: AttributionRunTrigger,
    from: Date,
    to: Date,
    context: TenantContext,
    modelId?: string,
  ) {
    return this.runAttribution(
      brandId,
      organisationId,
      { modelId, triggerReason, from, to },
      context,
    );
  },
};
