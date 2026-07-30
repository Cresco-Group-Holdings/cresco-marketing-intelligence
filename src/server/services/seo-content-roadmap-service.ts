import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { assertRoadmapTransition } from "@/lib/topics/roadmap";
import type { SeoRoadmapStatus } from "@prisma/client";
import type { TenantContext } from "@/lib/tenancy/context";
import { contentService } from "@/server/services/content-service";
import { brandService } from "@/server/services/workspace-service";

export const seoContentRoadmapService = {
  async listRoadmap(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const [pillars, supporting, gapPlans] = await Promise.all([
      prisma.seoPillarPage.findMany({
        where: { organisationId, brandId },
        include: { cluster: { select: { name: true } }, contentItem: { select: { id: true, title: true, status: true } } },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.seoSupportingPage.findMany({
        where: { organisationId, brandId },
        include: { cluster: { select: { name: true } }, contentItem: { select: { id: true, title: true, status: true } } },
        orderBy: { sequenceOrder: "asc" },
      }),
      prisma.seoContentGapPlan.findMany({
        where: { organisationId, brandId },
        include: { cluster: { select: { name: true } }, contentItem: { select: { id: true, title: true, status: true } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    return { pillars, supporting, gapPlans };
  },

  async transitionStatus(
    brandId: string,
    organisationId: string,
    input: { itemType: "pillar" | "supporting" | "gap_plan"; itemId: string; roadmapStatus: SeoRoadmapStatus },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);

    if (input.itemType === "pillar") {
      const item = await prisma.seoPillarPage.findFirst({ where: { id: input.itemId, brandId, organisationId } });
      if (!item) throw new AppError("NOT_FOUND", "Pillar page not found.");
      assertRoadmapTransition(item.roadmapStatus, input.roadmapStatus);
      return prisma.seoPillarPage.update({
        where: { id: input.itemId },
        data: { roadmapStatus: input.roadmapStatus },
      });
    }

    if (input.itemType === "supporting") {
      const item = await prisma.seoSupportingPage.findFirst({ where: { id: input.itemId, brandId, organisationId } });
      if (!item) throw new AppError("NOT_FOUND", "Supporting page not found.");
      assertRoadmapTransition(item.roadmapStatus, input.roadmapStatus);
      return prisma.seoSupportingPage.update({
        where: { id: input.itemId },
        data: { roadmapStatus: input.roadmapStatus },
      });
    }

    const item = await prisma.seoContentGapPlan.findFirst({ where: { id: input.itemId, brandId, organisationId } });
    if (!item) throw new AppError("NOT_FOUND", "Gap plan not found.");
    assertRoadmapTransition(item.roadmapStatus, input.roadmapStatus);
    return prisma.seoContentGapPlan.update({
      where: { id: input.itemId },
      data: { roadmapStatus: input.roadmapStatus },
    });
  },

  async linkToContent(
    brandId: string,
    organisationId: string,
    input: { itemType: "pillar" | "supporting" | "gap_plan"; itemId: string; title: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const content = await contentService.create(
      brandId,
      organisationId,
      {
        title: input.title,
        contentType: "ARTICLE_LINK",
        campaignName: "SEO Roadmap",
        contentPillar: "SEO",
      },
      context,
    );

    if (input.itemType === "pillar") {
      return prisma.seoPillarPage.update({
        where: { id: input.itemId },
        data: { contentItemId: content.id, roadmapStatus: "DRAFTING" },
      });
    }
    if (input.itemType === "supporting") {
      return prisma.seoSupportingPage.update({
        where: { id: input.itemId },
        data: { contentItemId: content.id, roadmapStatus: "DRAFTING" },
      });
    }
    return prisma.seoContentGapPlan.update({
      where: { id: input.itemId },
      data: { contentItemId: content.id, roadmapStatus: "DRAFTING" },
    });
  },
};
