import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { onPageAuditService } from "@/server/services/on-page-audit-service";

export const onPageOverrideService = {
  async createOverride(
    auditId: string,
    brandId: string,
    organisationId: string,
    input: { findingId?: string; recommendationId?: string; reason: string },
    context: TenantContext,
  ) {
    await onPageAuditService.getById(auditId, brandId, organisationId, context);

    if (!input.findingId && !input.recommendationId) {
      throw new AppError("VALIDATION_ERROR", "Either findingId or recommendationId is required.");
    }

    const override = await prisma.onPageSeoOverride.create({
      data: {
        organisationId,
        auditId,
        findingId: input.findingId,
        recommendationId: input.recommendationId,
        reason: input.reason,
        overriddenByUserId: context.userProfileId,
      },
    });

    if (input.findingId) {
      await prisma.onPageSeoFinding.update({
        where: { id: input.findingId },
        data: { status: "OVERRIDDEN" },
      });
    }

    if (input.recommendationId) {
      await prisma.onPageSeoRecommendation.update({
        where: { id: input.recommendationId },
        data: { status: "DISMISSED" },
      });
    }

    return override;
  },

  async updateRecommendationStatus(
    auditId: string,
    brandId: string,
    organisationId: string,
    recommendationId: string,
    status: "ACCEPTED" | "REJECTED" | "APPLIED" | "DISMISSED",
    context: TenantContext,
  ) {
    await onPageAuditService.getById(auditId, brandId, organisationId, context);
    return prisma.onPageSeoRecommendation.update({
      where: { id: recommendationId, auditId },
      data: { status },
    });
  },
};
