import { createHash } from "node:crypto";
import type { FunnelSegmentDimension, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { calculateFunnel } from "@/lib/funnel/calculator";
import { generateFunnelInsights, generateSegmentInsights } from "@/lib/funnel/insights";
import { sanitiseJourneySamples } from "@/lib/funnel/privacy";
import { enforceSegmentCardinality, getSegmentValue, isApprovedSegmentDimension } from "@/lib/funnel/segments";
import type { FunnelSubjectEvent } from "@/lib/funnel/types";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelService } from "@/server/services/funnel-service";
import { brandService } from "@/server/services/workspace-service";

function buildIdempotencyKey(parts: string[]) {
  return createHash("sha256").update(parts.join(":")).digest("hex");
}

export const funnelAnalysisService = {
  async loadEvents(
    brandId: string,
    organisationId: string,
    from: Date,
    to: Date,
  ): Promise<FunnelSubjectEvent[]> {
    const [events, sessions, leads] = await Promise.all([
      prisma.marketingEvent.findMany({
        where: { brandId, organisationId, occurredAt: { gte: from, lte: to } },
        include: { session: true },
        orderBy: { occurredAt: "asc" },
        take: 5000,
      }),
      prisma.marketingSession.findMany({
        where: { brandId, organisationId, startedAt: { gte: from, lte: to } },
        take: 2000,
      }),
      prisma.marketingLead.findMany({
        where: {
          brandId,
          organisationId,
          createdAt: { gte: from, lte: to },
          retentionStatus: { not: "DELETED" },
        },
        take: 1000,
      }),
    ]);

    const subjectEvents: FunnelSubjectEvent[] = [];

    for (const event of events) {
      const props = event.properties as Record<string, unknown> | null;
      subjectEvents.push({
        subjectKey: event.identityId ?? event.sessionId ?? event.id,
        occurredAt: event.occurredAt,
        eventName: event.eventName,
        pagePath: typeof props?.pagePath === "string" ? props.pagePath : undefined,
        sessionId: event.sessionId ?? undefined,
        identityId: event.identityId ?? undefined,
        campaign: event.marketingCampaignId ?? undefined,
        channel: typeof props?.channel === "string" ? props.channel : undefined,
        provider: event.provider,
        landingPage: event.session?.landingPage ?? undefined,
        device: event.session?.deviceCategory ?? undefined,
        country: event.session?.country ?? undefined,
        cohortDate: event.occurredAt.toISOString().slice(0, 10),
      });
    }

    for (const session of sessions) {
      subjectEvents.push({
        subjectKey: session.id,
        occurredAt: session.startedAt,
        eventName: "page_view",
        pagePath: session.landingPage ?? undefined,
        sessionId: session.id,
        landingPage: session.landingPage ?? undefined,
        channel: session.medium ?? undefined,
        campaign: session.campaign ?? session.utmCampaign ?? undefined,
        provider: session.provider,
        device: session.deviceCategory ?? undefined,
        country: session.country ?? undefined,
        cohortDate: session.startedAt.toISOString().slice(0, 10),
      });
    }

    for (const lead of leads) {
      subjectEvents.push({
        subjectKey: lead.id,
        occurredAt: lead.firstInteractionAt ?? lead.createdAt,
        eventName: "lead_status_change",
        leadStatus: lead.status,
        identityId: lead.id,
        cohortDate: lead.createdAt.toISOString().slice(0, 10),
      });
    }

    return subjectEvents.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  },

  async runAnalysis(
    brandId: string,
    organisationId: string,
    funnelId: string,
    input: {
      from: Date;
      to: Date;
      cohortDate?: Date;
      segmentDimension?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const funnel = await funnelService.getFunnel(brandId, organisationId, funnelId, context);
    const version = funnel.versions[0];
    if (!version) throw new AppError("VALIDATION_ERROR", "Funnel has no version.");

    if (input.segmentDimension && !isApprovedSegmentDimension(input.segmentDimension)) {
      throw new AppError("VALIDATION_ERROR", "Segment dimension is not in the approved list.");
    }

    const idempotencyKey = buildIdempotencyKey([
      funnelId,
      version.id,
      input.from.toISOString(),
      input.to.toISOString(),
      input.segmentDimension ?? "all",
    ]);

    const existing = await prisma.funnelAnalysisRun.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "COMPLETED") return existing;

    const run = await prisma.funnelAnalysisRun.upsert({
      where: { idempotencyKey },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        funnelId,
        funnelVersionId: version.id,
        status: "RUNNING",
        countingMethod: version.countingMethod,
        cohortDate: input.cohortDate,
        dateFrom: input.from,
        dateTo: input.to,
        segmentDimension: input.segmentDimension as FunnelSegmentDimension | undefined,
        startedAt: new Date(),
        idempotencyKey,
      },
      update: { status: "RUNNING", startedAt: new Date(), errorMessage: null },
    });

    try {
      const events = await this.loadEvents(brandId, organisationId, input.from, input.to);
      const steps = version.steps.map((step) => ({
        id: step.id,
        stepOrder: step.stepOrder,
        name: step.name,
        stepType: step.stepType,
        matchingRules: step.matchingRules as Record<string, unknown>,
        maxTimeToNextStepMs: step.maxTimeToNextStepMs,
        requirement: step.requirement,
      }));

      const result = calculateFunnel({
        steps,
        events,
        countingMethod: version.countingMethod,
        cohortDate: input.cohortDate,
      });

      const canViewSamples = hasPermission(context.organisationRole, PERMISSIONS["marketingData.viewRaw"]);
      const journeySamples = canViewSamples ? sanitiseJourneySamples(result.journeySamples) : [];

      for (const stepResult of result.stepResults) {
        await prisma.funnelStepResult.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            funnelAnalysisRunId: run.id,
            funnelStepId: stepResult.stepId,
            stepOrder: stepResult.stepOrder,
            stepName: stepResult.stepName,
            entrants: stepResult.entrants,
            completions: stepResult.completions,
            stepConversion: stepResult.stepConversion,
            cumulativeConversion: stepResult.cumulativeConversion,
            dropOffCount: stepResult.dropOffCount,
            dropOffRate: stepResult.dropOffRate,
            medianTimeToNextMs: stepResult.medianTimeToNextMs,
          },
        });
      }

      const stepInsights = generateFunnelInsights(result.stepResults);
      for (const insight of stepInsights) {
        await prisma.funnelDropOffInsight.create({
          data: {
            organisationId,
            projectId: brand.projectId,
            brandId,
            funnelAnalysisRunId: run.id,
            insightType: insight.insightType as never,
            stepOrder: insight.stepOrder,
            stepName: insight.stepName,
            segmentDimension: insight.segmentDimension,
            segmentValue: insight.segmentValue,
            metricValue: insight.metricValue,
            evidence: insight.evidence as Prisma.InputJsonValue,
            message: insight.message,
            severity: insight.severity,
          },
        });
      }

      if (input.segmentDimension && isApprovedSegmentDimension(input.segmentDimension)) {
        const segmentCounts = new Map<string, number>();
        for (const event of events) {
          const value = getSegmentValue(event, input.segmentDimension);
          if (!value) continue;
          segmentCounts.set(value, (segmentCounts.get(value) ?? 0) + 1);
        }
        const { allowed, rejected } = enforceSegmentCardinality(segmentCounts);

        for (const segmentValue of allowed) {
          const segmentEvents = events.filter(
            (e) => getSegmentValue(e, input.segmentDimension as FunnelSegmentDimension) === segmentValue,
          );
          const segmentResult = calculateFunnel({
            steps,
            events: segmentEvents,
            countingMethod: version.countingMethod,
          });
          const lastStep = segmentResult.stepResults[segmentResult.stepResults.length - 1];
          await prisma.funnelSegment.create({
            data: {
              organisationId,
              projectId: brand.projectId,
              brandId,
              funnelAnalysisRunId: run.id,
              dimension: input.segmentDimension as FunnelSegmentDimension,
              segmentValue,
              entrants: segmentResult.entrants,
              completions: segmentResult.totalConversions,
              conversionRate: lastStep?.cumulativeConversion ?? 0,
            },
          });
        }

        if (rejected.length > 0) {
          result.dataQualityWarnings.push(
            `${rejected.length} high-cardinality segment values were excluded (max 50).`,
          );
        }
      }

      return prisma.funnelAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          entrants: result.entrants,
          totalConversions: result.totalConversions,
          journeySamples: journeySamples as object[],
          dataQualityWarnings: result.dataQualityWarnings,
          completedAt: new Date(),
        },
        include: {
          stepResults: { orderBy: { stepOrder: "asc" } },
          insights: true,
          segments: true,
        },
      });
    } catch (error) {
      await prisma.funnelAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Funnel analysis failed.",
          completedAt: new Date(),
        },
      });
      throw error;
    }
  },
};
