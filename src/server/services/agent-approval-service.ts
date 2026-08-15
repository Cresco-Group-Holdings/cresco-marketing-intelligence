import { prisma } from "@/lib/database/prisma";
import { resolveApprovalStatus } from "@/lib/agent-platform/approval-gates";
import { AppError } from "@/lib/errors";
import { assertOrganisationScope, type TenantContext } from "@/lib/tenancy/context";
import type { AgentApprovalDecisionInput } from "@/lib/validation/agent-platform";

export const agentApprovalService = {
  async decide(
    organisationId: string,
    approvalId: string,
    input: AgentApprovalDecisionInput,
    context: TenantContext,
  ) {
    assertOrganisationScope(organisationId, context);

    const approval = await prisma.agentPlatformApproval.findFirst({
      where: { id: approvalId, organisationId },
      include: { proposedAction: true, run: true },
    });

    if (!approval) throw new AppError("NOT_FOUND", "Agent approval not found.");
    if (approval.status !== "PENDING") {
      throw new AppError("CONFLICT", "Approval has already been decided.");
    }

    const nextStatus = resolveApprovalStatus(approval.status, input.decision);

    const [updatedApproval] = await prisma.$transaction([
      prisma.agentPlatformApproval.update({
        where: { id: approvalId },
        data: {
          status: nextStatus,
          decidedByUserId: context.userProfileId,
          decidedAt: new Date(),
          comment: input.comment,
        },
      }),
      ...(approval.proposedActionId
        ? [
            prisma.agentPlatformProposedAction.update({
              where: { id: approval.proposedActionId },
              data: {
                status: input.decision === "APPROVED" ? "APPROVED" : "REJECTED",
              },
            }),
          ]
        : []),
    ]);

    const pending = await prisma.agentPlatformApproval.count({
      where: { runId: approval.runId, status: "PENDING" },
    });

    if (pending === 0) {
      await prisma.agentPlatformRun.update({
        where: { id: approval.runId },
        data: { status: "COMPLETED" },
      });
    }

    return {
      id: updatedApproval.id,
      status: updatedApproval.status,
      decidedAt: updatedApproval.decidedAt?.toISOString() ?? null,
      note: "Approved actions are recorded only; v1 does not auto-execute high-impact operations.",
    };
  },
};
