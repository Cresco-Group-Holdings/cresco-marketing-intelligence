import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const BUDGET_CHANGE_WARNING_THRESHOLD = 0.2;

export type BudgetChangeInput = {
  externalCampaignId: string;
  currency: string;
  currentBudget: number;
  proposedBudget: number;
};

export const publicationBudgetService = {
  evaluateChange(input: BudgetChangeInput) {
    if (input.currentBudget <= 0) {
      throw new AppError("VALIDATION_ERROR", "Current budget must be positive.");
    }
    if (input.proposedBudget < 0) {
      throw new AppError("VALIDATION_ERROR", "Proposed budget cannot be negative.");
    }

    const percentageChange = (input.proposedBudget - input.currentBudget) / input.currentBudget;
    const requiresApproval = Math.abs(percentageChange) > BUDGET_CHANGE_WARNING_THRESHOLD;

    return {
      percentageChange,
      requiresApproval,
      warning:
        requiresApproval
          ? `Budget change of ${(percentageChange * 100).toFixed(1)}% exceeds the ${BUDGET_CHANGE_WARNING_THRESHOLD * 100}% threshold.`
          : null,
    };
  },

  async recordChange(
    publicationId: string,
    organisationId: string,
    brandId: string,
    providerKey: string,
    input: BudgetChangeInput,
    context: TenantContext,
  ) {
    if (!hasPermission(context.organisationRole, PERMISSIONS["advertisingBudgets.manage"])) {
      throw new AppError("FORBIDDEN", "Insufficient permission to manage budgets.");
    }

    const evaluation = this.evaluateChange(input);

    return prisma.publicationBudgetChange.create({
      data: {
        publicationId,
        organisationId,
        brandId,
        providerKey,
        externalCampaignId: input.externalCampaignId,
        currency: input.currency,
        currentBudget: input.currentBudget,
        proposedBudget: input.proposedBudget,
        percentageChange: evaluation.percentageChange,
        requiresApproval: evaluation.requiresApproval,
        approvedByUserId: evaluation.requiresApproval ? undefined : context.userProfileId,
        approvedAt: evaluation.requiresApproval ? undefined : new Date(),
      },
    });
  },

  async approveChange(
    publicationId: string,
    changeId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    if (!hasPermission(context.organisationRole, PERMISSIONS["advertisingBudgets.approve"])) {
      throw new AppError("FORBIDDEN", "Insufficient permission to approve budget changes.");
    }

    const change = await prisma.publicationBudgetChange.findFirst({
      where: { id: changeId, publicationId, organisationId },
    });
    if (!change) throw new AppError("NOT_FOUND", "Budget change not found.");

    return prisma.publicationBudgetChange.update({
      where: { id: changeId },
      data: {
        approvedByUserId: context.userProfileId,
        approvedAt: new Date(),
      },
    });
  },
};
