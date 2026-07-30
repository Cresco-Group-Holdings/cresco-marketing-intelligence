import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { internalLinkGraphService } from "@/server/services/internal-link-graph-service";

export const internalLinkProposalService = {
  async createProposal(
    graphId: string,
    brandId: string,
    organisationId: string,
    input: {
      recommendationId?: string;
      action: string;
      editedAnchorConcept?: string;
      assignedToUserId?: string;
    },
    context: TenantContext,
  ) {
    await internalLinkGraphService.getById(graphId, brandId, organisationId, context);

    if (input.action === "APPROVE" && input.recommendationId) {
      await prisma.internalLinkRecommendation.update({
        where: { id: input.recommendationId },
        data: { status: "APPROVED" },
      });
    }

    if (input.action === "REJECT" && input.recommendationId) {
      await prisma.internalLinkRecommendation.update({
        where: { id: input.recommendationId },
        data: { status: "REJECTED" },
      });
    }

    const statusMap: Record<string, "DRAFT" | "APPROVED" | "REJECTED" | "EXPORTED" | "IMPLEMENTED" | "VERIFIED"> = {
      APPROVE: "APPROVED",
      REJECT: "REJECTED",
      EXPORT: "EXPORTED",
      IMPLEMENT: "IMPLEMENTED",
      VERIFY: "VERIFIED",
      EDIT: "DRAFT",
      ASSIGN: "DRAFT",
    };

    const exportPayload = input.action === "EXPORT" && input.recommendationId
      ? await this.buildExportPayload(input.recommendationId)
      : undefined;

    return prisma.internalLinkChangeProposal.create({
      data: {
        organisationId,
        graphId,
        recommendationId: input.recommendationId,
        status: statusMap[input.action] ?? "DRAFT",
        editedAnchorConcept: input.editedAnchorConcept,
        assignedToUserId: input.assignedToUserId,
        exportPayload: exportPayload as Prisma.InputJsonValue,
        implementedAt: input.action === "IMPLEMENT" ? new Date() : undefined,
        verifiedAt: input.action === "VERIFY" ? new Date() : undefined,
        createdByUserId: context.userProfileId,
      },
    });
  },

  async buildExportPayload(recommendationId: string) {
    const rec = await prisma.internalLinkRecommendation.findUnique({
      where: { id: recommendationId },
      include: { sourceNode: true, targetNode: true },
    });
    if (!rec) throw new AppError("NOT_FOUND", "Recommendation not found.");
    return {
      sourceUrl: rec.sourceNode.url,
      targetUrl: rec.targetNode.url,
      suggestedAnchorConcept: rec.suggestedAnchorConcept,
      reason: rec.contextualReason,
      note: "Manual implementation required — no automatic website changes.",
    };
  },

  async verifyImplementation(
    graphId: string,
    brandId: string,
    organisationId: string,
    proposalId: string,
    context: TenantContext,
  ) {
    await internalLinkGraphService.getById(graphId, brandId, organisationId, context);
    const proposal = await prisma.internalLinkChangeProposal.update({
      where: { id: proposalId },
      data: { status: "VERIFIED", verifiedAt: new Date() },
    });
    if (proposal.recommendationId) {
      await prisma.internalLinkRecommendation.update({
        where: { id: proposal.recommendationId },
        data: { status: "VERIFIED" },
      });
    }
    return proposal;
  },
};
