import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { BRIEF_STATUS_TRANSITIONS } from "@/lib/briefs/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { seoContentBriefService } from "@/server/services/seo-content-brief-service";
import { brandService } from "@/server/services/workspace-service";

function assertBriefTransition(from: string, to: string) {
  const allowed = BRIEF_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError("VALIDATION_ERROR", `Cannot transition brief from ${from} to ${to}.`);
  }
}

export const seoBriefApprovalService = {
  async submitForReview(briefId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brief = await seoContentBriefService.getById(briefId, brandId, organisationId, context);
    assertBriefTransition(brief.status, "IN_REVIEW");

    const version = brief.versions[0];
    await prisma.seoContentBrief.update({ where: { id: briefId }, data: { status: "IN_REVIEW" } });
    if (version) {
      await prisma.seoContentBriefVersion.update({ where: { id: version.id }, data: { status: "IN_REVIEW" } });
    }

    await prisma.seoBriefApproval.create({
      data: {
        organisationId,
        briefId,
        versionId: version?.id,
        requestedByUserId: context.userProfileId,
        decision: "PENDING",
      },
    });

    return seoContentBriefService.getById(briefId, brandId, organisationId, context);
  },

  async decide(
    briefId: string,
    brandId: string,
    organisationId: string,
    input: { decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; decisionNote?: string; versionId?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const brief = await seoContentBriefService.getById(briefId, brandId, organisationId, context);
    if (brief.status !== "IN_REVIEW") {
      throw new AppError("VALIDATION_ERROR", "Brief must be in review to decide.");
    }

    const newStatus = input.decision === "APPROVED" ? "APPROVED" : "CHANGES_REQUESTED";
    assertBriefTransition(brief.status, newStatus);

    const pending = await prisma.seoBriefApproval.findFirst({
      where: { briefId, organisationId, decision: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    if (pending) {
      await prisma.seoBriefApproval.update({
        where: { id: pending.id },
        data: {
          decision: input.decision,
          approverUserId: context.userProfileId,
          decisionNote: input.decisionNote,
          decidedAt: new Date(),
        },
      });
    }

    await prisma.seoContentBrief.update({ where: { id: briefId }, data: { status: newStatus } });
    if (input.versionId) {
      await prisma.seoContentBriefVersion.update({
        where: { id: input.versionId },
        data: { status: newStatus },
      });
    }

    return seoContentBriefService.getById(briefId, brandId, organisationId, context);
  },

  async addComment(
    briefId: string,
    brandId: string,
    organisationId: string,
    input: { body: string; versionId?: string },
    context: TenantContext,
  ) {
    await seoContentBriefService.getById(briefId, brandId, organisationId, context);
    return prisma.seoBriefComment.create({
      data: {
        organisationId,
        briefId,
        versionId: input.versionId,
        authorUserId: context.userProfileId,
        body: input.body,
      },
    });
  },
};
