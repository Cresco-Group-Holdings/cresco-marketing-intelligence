import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { advertisingCampaignPlanService } from "@/server/services/advertising-campaign-plan-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingCampaignApprovalService = {
  async requestApproval(
    planId: string,
    brandId: string,
    organisationId: string,
    approvalType: "STRATEGY" | "BUDGET" | "AUDIENCE" | "CREATIVE" | "COMPLIANCE" | "LAUNCH",
    context: TenantContext,
  ) {
    const plan = await advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
    if (!["READY_FOR_REVIEW", "PLANNING", "CHANGES_REQUESTED"].includes(plan.status)) {
      throw new AppError("VALIDATION_ERROR", "Plan must be in planning or review to request approval.");
    }

    return prisma.advertisingCampaignApproval.create({
      data: {
        organisationId,
        planId,
        approvalType,
        requestedByUserId: context.userProfileId,
        decision: "PENDING",
      },
    });
  },

  async decide(
    planId: string,
    brandId: string,
    organisationId: string,
    input: {
      approvalType: "STRATEGY" | "BUDGET" | "AUDIENCE" | "CREATIVE" | "COMPLIANCE" | "LAUNCH";
      decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
      decisionNote?: string;
    },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const pending = await prisma.advertisingCampaignApproval.findFirst({
      where: { planId, organisationId, approvalType: input.approvalType, decision: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) throw new AppError("NOT_FOUND", "No pending approval found.");

    await prisma.advertisingCampaignApproval.update({
      where: { id: pending.id },
      data: {
        decision: input.decision,
        decisionNote: input.decisionNote,
        approverUserId: context.userProfileId,
        decidedAt: new Date(),
      },
    });

    if (input.decision === "CHANGES_REQUESTED") {
      await prisma.advertisingCampaignPlan.update({
        where: { id: planId },
        data: { status: "CHANGES_REQUESTED" },
      });
    }

    if (input.approvalType === "LAUNCH" && input.decision === "APPROVED") {
      const allRequired = await prisma.advertisingCampaignApproval.findMany({
        where: { planId, decision: "APPROVED" },
      });
      const types = new Set(allRequired.map((a) => a.approvalType));
      const complete = ["STRATEGY", "BUDGET", "AUDIENCE", "CREATIVE", "COMPLIANCE", "LAUNCH"].every((t) =>
        types.has(t as never),
      );
      if (complete) {
        await prisma.advertisingCampaignPlan.update({
          where: { id: planId },
          data: { status: "APPROVED" },
        });
      }
    }

    return advertisingCampaignPlanService.getById(planId, brandId, organisationId, context);
  },
};
