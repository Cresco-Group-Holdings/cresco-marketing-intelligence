import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

export const marketingWarehouseCorrectionService = {
  async applyCorrection(
    organisationId: string,
    input: {
      brandId: string;
      observationId: string;
      correctedValue: number;
      reason: string;
    },
    context: TenantContext,
    requestId?: string,
  ) {
    const brand = await brandService.getById(input.brandId, organisationId, context);
    const observation = await prisma.marketingMetricObservation.findFirst({
      where: {
        id: input.observationId,
        organisationId,
        brandId: input.brandId,
      },
    });
    if (!observation) {
      throw new AppError("NOT_FOUND", "Metric observation was not found.");
    }

    const correction = await prisma.marketingMetricCorrection.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId: input.brandId,
        marketingDataSourceAccountId: observation.marketingDataSourceAccountId,
        marketingMetricDefinitionId: observation.marketingMetricDefinitionId,
        marketingMetricObservationId: observation.id,
        provider: observation.provider,
        metricKey: observation.metricKey,
        originalValue: observation.metricValue,
        correctedValue: input.correctedValue,
        reason: input.reason,
        observedAt: observation.observedAt,
      },
    });

    await recordAuditEvent({
      organisationId,
      projectId: brand.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.metric.corrected",
      resourceType: "MarketingMetricCorrection",
      resourceId: correction.id,
      requestId,
      metadata: {
        observationId: observation.id,
        originalValue: observation.metricValue.toString(),
        correctedValue: input.correctedValue,
      },
    });

    return correction;
  },

  async listCorrections(
    brandId: string,
    organisationId: string,
    filters: { observationId?: string; limit: number },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.marketingMetricCorrection.findMany({
      where: {
        organisationId,
        brandId,
        ...(filters.observationId
          ? { marketingMetricObservationId: filters.observationId }
          : {}),
      },
      orderBy: { appliedAt: "desc" },
      take: filters.limit,
    });
  },

  async getLatestCorrectionsForObservations(observationIds: string[]) {
    if (observationIds.length === 0) return [];
    return prisma.marketingMetricCorrection.findMany({
      where: { marketingMetricObservationId: { in: observationIds } },
      orderBy: { appliedAt: "desc" },
    });
  },
};
