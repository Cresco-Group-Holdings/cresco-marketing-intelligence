import { prisma } from "@/lib/database/prisma";
import {
  COUNTING_METHOD_LABELS,
  FUNNEL_DISCLAIMER,
  SEGMENT_DIMENSION_LABELS,
} from "@/lib/funnel/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";
import { funnelService } from "@/server/services/funnel-service";
import { brandService } from "@/server/services/workspace-service";

export const funnelDashboardService = {
  async getOverview(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const funnels = await funnelService.listFunnels(brandId, organisationId, context);
    const recentRuns = await prisma.funnelAnalysisRun.findMany({
      where: { brandId, organisationId, status: "COMPLETED" },
      include: { funnel: true, stepResults: { orderBy: { stepOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return {
      funnelCount: funnels.length,
      recentRuns: recentRuns.map((run) => ({
        id: run.id,
        funnelName: run.funnel.name,
        entrants: run.entrants,
        totalConversions: run.totalConversions,
        conversionRate: run.entrants > 0 ? (run.totalConversions / run.entrants) * 100 : 0,
        dateFrom: run.dateFrom.toISOString(),
        dateTo: run.dateTo.toISOString(),
        completedAt: run.completedAt?.toISOString(),
      })),
      disclaimer: FUNNEL_DISCLAIMER,
    };
  },

  async getFunnelDetail(
    brandId: string,
    organisationId: string,
    funnelId: string,
    from: Date,
    to: Date,
    context: TenantContext,
  ) {
    const funnel = await funnelService.getFunnel(brandId, organisationId, funnelId, context);
    const latestRun = await prisma.funnelAnalysisRun.findFirst({
      where: {
        funnelId,
        brandId,
        organisationId,
        status: "COMPLETED",
        dateFrom: { gte: from },
        dateTo: { lte: to },
      },
      include: {
        stepResults: { orderBy: { stepOrder: "asc" } },
        insights: true,
        segments: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const canViewSamples = hasPermission(context.organisationRole, PERMISSIONS["marketingData.viewRaw"]);

    return {
      funnel: {
        id: funnel.id,
        name: funnel.name,
        description: funnel.description,
        countingMethod: funnel.countingMethod,
        countingMethodLabel: COUNTING_METHOD_LABELS[funnel.countingMethod],
        templateType: funnel.templateType,
        steps: funnel.versions[0]?.steps.map((step) => ({
          id: step.id,
          stepOrder: step.stepOrder,
          name: step.name,
          stepType: step.stepType,
          requirement: step.requirement,
          maxTimeToNextStepMs: step.maxTimeToNextStepMs,
        })) ?? [],
      },
      analysis: latestRun
        ? {
            id: latestRun.id,
            entrants: latestRun.entrants,
            totalConversions: latestRun.totalConversions,
            cohortDate: latestRun.cohortDate?.toISOString() ?? null,
            stepResults: latestRun.stepResults.map((sr) => ({
              stepOrder: sr.stepOrder,
              stepName: sr.stepName,
              entrants: sr.entrants,
              completions: sr.completions,
              stepConversion: Number(sr.stepConversion),
              cumulativeConversion: Number(sr.cumulativeConversion),
              dropOffCount: sr.dropOffCount,
              dropOffRate: Number(sr.dropOffRate),
              medianTimeToNextMs: sr.medianTimeToNextMs,
            })),
            insights: latestRun.insights.map((i) => ({
              type: i.insightType,
              message: i.message,
              severity: i.severity,
              stepOrder: i.stepOrder,
              stepName: i.stepName,
            })),
            journeySamples: canViewSamples ? latestRun.journeySamples : [],
            dataQualityWarnings: latestRun.dataQualityWarnings,
          }
        : null,
      disclaimer: FUNNEL_DISCLAIMER,
    };
  },

  async getCohorts(
    brandId: string,
    organisationId: string,
    funnelId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const runs = await prisma.funnelAnalysisRun.findMany({
      where: { funnelId, brandId, organisationId, status: "COMPLETED", cohortDate: { not: null } },
      include: { stepResults: { orderBy: { stepOrder: "asc" } } },
      orderBy: { cohortDate: "desc" },
      take: 30,
    });

    return runs.map((run) => ({
      cohortDate: run.cohortDate?.toISOString().slice(0, 10),
      entrants: run.entrants,
      totalConversions: run.totalConversions,
      conversionRate: run.entrants > 0 ? (run.totalConversions / run.entrants) * 100 : 0,
      stepResults: run.stepResults.map((sr) => ({
        stepName: sr.stepName,
        cumulativeConversion: Number(sr.cumulativeConversion),
      })),
    }));
  },

  async getSegments(
    brandId: string,
    organisationId: string,
    funnelId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const segments = await prisma.funnelSegment.findMany({
      where: { brandId, organisationId, funnelAnalysisRun: { funnelId } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return segments.map((s) => ({
      dimension: s.dimension,
      dimensionLabel: SEGMENT_DIMENSION_LABELS[s.dimension],
      segmentValue: s.segmentValue,
      entrants: s.entrants,
      completions: s.completions,
      conversionRate: Number(s.conversionRate ?? 0),
    }));
  },

  async getWarnings(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const failedRuns = await prisma.funnelAnalysisRun.count({
      where: { brandId, organisationId, status: "FAILED" },
    });
    const funnelsWithoutRuns = await prisma.marketingFunnel.count({
      where: { brandId, organisationId, runs: { none: {} } },
    });

    return {
      warnings: [
        ...(failedRuns > 0
          ? [{ level: "warning", message: `${failedRuns} funnel analysis run(s) failed.` }]
          : []),
        ...(funnelsWithoutRuns > 0
          ? [{ level: "info", message: `${funnelsWithoutRuns} funnel(s) have not been analysed yet.` }]
          : []),
        { level: "info", message: FUNNEL_DISCLAIMER },
      ],
      dataLimitations: [
        "Cross-device identity linking may cause under-counting in user-based funnels.",
        "Late-arriving events may require re-running analysis.",
        "Deleted identities are excluded from user-based counting.",
      ],
    };
  },
};
