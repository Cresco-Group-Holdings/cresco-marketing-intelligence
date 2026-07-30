import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { runAdCreativeComplianceChecks, hasBlockingAdComplianceFindings } from "@/lib/advertising-creatives/compliance";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCreativeProjectService } from "@/server/services/advertising-creative-project-service";

export const advertisingCreativeReviewService = {
  async submitForReview(creativeId: string, brandId: string, organisationId: string, context: TenantContext) {
    const project = await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);
    const copyText = project.copies.map((c) => c.fieldValue).join("\n");
    const findings = runAdCreativeComplianceChecks({ copyText });

    if (hasBlockingAdComplianceFindings(findings)) {
      throw new AppError("VALIDATION_ERROR", "Blocking compliance findings must be resolved before review.");
    }

    await advertisingCreativeProjectService.createVersion(creativeId, brandId, organisationId, context, "Submitted for review");

    return prisma.advertisingCreativeProject.update({
      where: { id: creativeId },
      data: { status: "IN_REVIEW" },
    });
  },

  async decide(
    creativeId: string,
    brandId: string,
    organisationId: string,
    input: {
      reviewerRole: "MARKETER" | "BRAND_OWNER" | "COMPLIANCE_REVIEWER" | "BUDGET_OWNER" | "CLIENT_APPROVER";
      decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
      decisionNote?: string;
      comment?: string;
      lockedSections?: string[];
    },
    context: TenantContext,
  ) {
    await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);

    const review = await prisma.advertisingCreativeReview.create({
      data: {
        organisationId,
        creativeProjectId: creativeId,
        reviewerRole: input.reviewerRole,
        decision: input.decision,
        decisionNote: input.decisionNote,
        comment: input.comment,
        lockedSections: input.lockedSections ?? [],
        reviewerUserId: context.userProfileId,
        decidedAt: new Date(),
      },
    });

    if (input.decision === "CHANGES_REQUESTED") {
      await prisma.advertisingCreativeProject.update({
        where: { id: creativeId },
        data: { status: "CHANGES_REQUESTED" },
      });
    }

    if (input.decision === "APPROVED" && input.reviewerRole === "COMPLIANCE_REVIEWER") {
      const complianceApproved = await prisma.advertisingCreativeReview.findFirst({
        where: { creativeProjectId: creativeId, reviewerRole: "COMPLIANCE_REVIEWER", decision: "APPROVED" },
      });
      const marketerApproved = await prisma.advertisingCreativeReview.findFirst({
        where: { creativeProjectId: creativeId, reviewerRole: "MARKETER", decision: "APPROVED" },
      });
      if (complianceApproved && marketerApproved) {
        await prisma.advertisingCreativeProject.update({
          where: { id: creativeId },
          data: { status: "APPROVED" },
        });
      }
    }

    return review;
  },

  async lockCopyField(
    creativeId: string,
    brandId: string,
    organisationId: string,
    copyId: string,
    context: TenantContext,
  ) {
    await advertisingCreativeProjectService.getById(creativeId, brandId, organisationId, context);
    return prisma.advertisingCreativeCopy.update({
      where: { id: copyId },
      data: { isLocked: true },
    });
  },
};
