import type { AttributionJourneyStatus, DirectTrafficPolicy } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";
import { attributionTouchpointService } from "@/server/services/attribution-touchpoint-service";

const JOURNEY_LIMITATIONS = [
  "Cross-device journeys may be incomplete when identities are not linked.",
  "Consent restrictions may exclude some touchpoints.",
];

export const attributionJourneyService = {
  async listJourneys(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    context: TenantContext,
    status?: AttributionJourneyStatus,
  ) {
    await brandService.getById(brandId, organisationId, context);

    return prisma.attributionJourney.findMany({
      where: {
        brandId,
        organisationId,
        journeyEnd: { gte: from, lte: to },
        ...(status ? { status } : {}),
      },
      include: {
        touchpoints: { orderBy: { position: "asc" } },
        identity: true,
        results: {
          include: { credits: true, attributionModel: true },
          orderBy: { calculatedAt: "desc" },
          take: 1,
        },
      },
      orderBy: { journeyEnd: "desc" },
      take: 100,
    });
  },

  async getJourney(brandId: string, organisationId: string, journeyId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const journey = await prisma.attributionJourney.findFirst({
      where: { id: journeyId, brandId, organisationId },
      include: {
        touchpoints: { orderBy: { position: "asc" } },
        identity: true,
        results: {
          include: {
            credits: { include: { attributionTouchpoint: true } },
            attributionModel: true,
            attributionModelVersion: true,
          },
          orderBy: { calculatedAt: "desc" },
        },
      },
    });
    if (!journey) throw new AppError("NOT_FOUND", "Attribution journey was not found.");
    return journey;
  },

  async buildJourneyFromConversion(
    brandId: string,
    organisationId: string,
    input: {
      identityId?: string | null;
      conversionEventId?: string | null;
      conversionDefinitionId?: string | null;
      revenueRecordId?: string | null;
      conversionType: string;
      conversionKey?: string | null;
      conversionAt: Date;
      revenueValue?: number | null;
      revenueCurrency?: string | null;
      lookbackWindowDays: number;
      directTrafficPolicy: DirectTrafficPolicy;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    if (!input.identityId) {
      const journey = await prisma.attributionJourney.create({
        data: {
          organisationId,
          projectId: brand.projectId,
          brandId,
          conversionType: input.conversionType,
          conversionKey: input.conversionKey,
          conversionEventId: input.conversionEventId,
          conversionDefinitionId: input.conversionDefinitionId,
          revenueRecordId: input.revenueRecordId,
          journeyStart: input.conversionAt,
          journeyEnd: input.conversionAt,
          status: "UNATTRIBUTED",
          revenueValue: input.revenueValue,
          revenueCurrency: input.revenueCurrency,
          lookbackWindowDays: input.lookbackWindowDays,
          directTrafficPolicy: input.directTrafficPolicy,
          limitations: {
            messages: [...JOURNEY_LIMITATIONS, "No identity available — journey cannot be attributed."],
          },
        },
      });
      return journey;
    }

    const windowStart = new Date(
      input.conversionAt.getTime() - input.lookbackWindowDays * 86_400_000,
    );
    const drafts = await attributionTouchpointService.extractTouchpointsForIdentity(
      brandId,
      organisationId,
      input.identityId,
      windowStart,
      input.conversionAt,
      context,
    );

    const journeyStart = drafts[0]?.occurredAt ?? input.conversionAt;
    const limitations = [...JOURNEY_LIMITATIONS];
    if (drafts.length === 0) {
      limitations.push("No touchpoints found within lookback window.");
    }

    const journey = await prisma.attributionJourney.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        identityId: input.identityId,
        conversionType: input.conversionType,
        conversionKey: input.conversionKey,
        conversionEventId: input.conversionEventId,
        conversionDefinitionId: input.conversionDefinitionId,
        revenueRecordId: input.revenueRecordId,
        journeyStart,
        journeyEnd: input.conversionAt,
        status: drafts.length > 0 ? "CONVERTED" : "UNATTRIBUTED",
        revenueValue: input.revenueValue,
        revenueCurrency: input.revenueCurrency,
        lookbackWindowDays: input.lookbackWindowDays,
        directTrafficPolicy: input.directTrafficPolicy,
        limitations: { messages: limitations },
      },
    });

    if (drafts.length > 0) {
      await attributionTouchpointService.persistTouchpoints(
        brandId,
        organisationId,
        brand.projectId,
        journey.id,
        drafts,
      );
    }

    return this.getJourney(brandId, organisationId, journey.id, context);
  },

  async markRefunded(brandId: string, organisationId: string, journeyId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const journey = await prisma.attributionJourney.findFirst({
      where: { id: journeyId, brandId, organisationId },
    });
    if (!journey) throw new AppError("NOT_FOUND", "Attribution journey was not found.");

    return prisma.attributionJourney.update({
      where: { id: journeyId },
      data: { status: "REFUNDED", revenueValue: 0 },
    });
  },

  async syncJourneysFromConversions(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
    lookbackWindowDays: number,
    directTrafficPolicy: DirectTrafficPolicy,
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);

    const conversionEvents = await prisma.marketingEvent.findMany({
      where: {
        brandId,
        organisationId,
        occurredAt: { gte: from, lte: to },
        eventName: { in: ["purchase", "signup", "trial_started", "subscription_created", "conversion"] },
      },
      orderBy: { occurredAt: "asc" },
      take: 200,
    });

    const journeys = [];
    for (const event of conversionEvents) {
      const existing = await prisma.attributionJourney.findFirst({
        where: { brandId, organisationId, conversionEventId: event.id },
      });
      if (existing) {
        journeys.push(existing);
        continue;
      }

      const props = event.properties as Record<string, unknown> | null;
      const revenueValue =
        typeof props?.value === "number"
          ? props.value
          : typeof props?.revenue === "number"
            ? props.revenue
            : null;

      const journey = await this.buildJourneyFromConversion(
        brandId,
        organisationId,
        {
          identityId: event.identityId,
          conversionEventId: event.id,
          conversionType: event.eventName,
          conversionKey: event.eventName,
          conversionAt: event.occurredAt,
          revenueValue,
          revenueCurrency: typeof props?.currency === "string" ? props.currency : "USD",
          lookbackWindowDays,
          directTrafficPolicy,
        },
        context,
      );
      journeys.push(journey);
    }

    return journeys;
  },
};
