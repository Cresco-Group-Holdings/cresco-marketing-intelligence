import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const crmAudienceSegmentService = {
  async listSegments(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmAudienceSegment.findMany({
      where: { organisationId, brandId, status: { not: "ARCHIVED" } },
      orderBy: { name: "asc" },
    });
  },

  async createSegment(
    brandId: string,
    organisationId: string,
    input: { name: string; description?: string; rules: Prisma.InputJsonValue },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.crmAudienceSegment.create({
      data: {
        organisationId,
        brandId,
        name: input.name,
        description: input.description,
        rules: input.rules,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async approveSegment(segmentId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const segment = await prisma.crmAudienceSegment.findFirst({
      where: { id: segmentId, organisationId, brandId },
    });
    if (!segment) throw new AppError("NOT_FOUND", "Segment not found.");
    return prisma.crmAudienceSegment.update({
      where: { id: segmentId },
      data: { status: "APPROVED", approvedByUserId: context.userProfileId, approvedAt: new Date() },
    });
  },
};
