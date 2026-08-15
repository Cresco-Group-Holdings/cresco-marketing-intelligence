import { MarketingApprovalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type {
  MarketingApprovalCreateInput,
  MarketingApprovalDecisionInput,
} from "@/lib/validation/marketing-approvals";
import { recordAuditEvent } from "@/server/services/audit-service";
import { brandService } from "@/server/services/workspace-service";

type BrandScope = {
  organisationId: string;
  projectId: string;
  brandId: string;
};

const APPROVAL_INCLUDE = {
  requester: { select: { id: true, displayName: true, email: true } },
  decisions: {
    orderBy: { decidedAt: "asc" as const },
    include: { decider: { select: { id: true, displayName: true, email: true } } },
  },
} satisfies Prisma.MarketingApprovalRequestInclude;

async function resolveBrandScope(
  brandId: string,
  organisationId: string,
  context: TenantContext,
): Promise<BrandScope> {
  const brand = await brandService.getById(brandId, organisationId, context);
  return { organisationId, projectId: brand.projectId, brandId };
}

async function getApprovalOrThrow(scope: BrandScope, approvalId: string) {
  const approval = await prisma.marketingApprovalRequest.findFirst({
    where: {
      id: approvalId,
      organisationId: scope.organisationId,
      brandId: scope.brandId,
    },
    include: APPROVAL_INCLUDE,
  });
  if (!approval) {
    throw new AppError("NOT_FOUND", "Approval request was not found.");
  }
  return approval;
}

function assertCanDecide(input: {
  requesterUserId: string;
  deciderUserId: string;
  separationOfDuties?: boolean;
}) {
  if (input.separationOfDuties !== false && input.requesterUserId === input.deciderUserId) {
    throw new AppError(
      "FORBIDDEN",
      "Approvers cannot decide on their own approval requests.",
    );
  }
}

function serializeApproval(approval: Awaited<ReturnType<typeof getApprovalOrThrow>>) {
  return {
    id: approval.id,
    type: approval.type,
    status: approval.status,
    title: approval.title,
    description: approval.description,
    entityType: approval.entityType,
    entityId: approval.entityId,
    version: approval.version,
    requesterUserId: approval.requesterUserId,
    requester: approval.requester,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
    decisions: approval.decisions.map((d) => ({
      id: d.id,
      decision: d.decision,
      feedback: d.feedback,
      deciderUserId: d.deciderUserId,
      decider: d.decider,
      decidedAt: d.decidedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export const marketingApprovalService = {
  async list(
    brandId: string,
    organisationId: string,
    context: TenantContext,
    filters?: {
      status?: MarketingApprovalStatus;
      type?: import("@prisma/client").MarketingApprovalType;
      entityType?: string;
      entityId?: string;
      myRequests?: boolean;
      pendingOnly?: boolean;
    },
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const approvals = await prisma.marketingApprovalRequest.findMany({
      where: {
        organisationId: scope.organisationId,
        brandId: scope.brandId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.entityId ? { entityId: filters.entityId } : {}),
        ...(filters?.myRequests ? { requesterUserId: context.userProfileId } : {}),
        ...(filters?.pendingOnly ? { status: "PENDING" } : {}),
      },
      include: APPROVAL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return approvals.map(serializeApproval);
  },

  async getById(
    brandId: string,
    organisationId: string,
    approvalId: string,
    context: TenantContext,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const approval = await getApprovalOrThrow(scope, approvalId);
    return serializeApproval(approval);
  },

  async create(
    brandId: string,
    organisationId: string,
    input: MarketingApprovalCreateInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);

    const approval = await prisma.marketingApprovalRequest.create({
      data: {
        organisationId: scope.organisationId,
        projectId: scope.projectId,
        brandId: scope.brandId,
        type: input.type,
        title: input.title,
        description: input.description || null,
        requesterUserId: context.userProfileId,
        entityType: input.entityType,
        entityId: input.entityId,
        status: "PENDING",
      },
    });

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: "marketingApproval.created",
      resourceType: "marketingApprovalRequest",
      resourceId: approval.id,
      requestId,
    });

    return this.getById(brandId, organisationId, approval.id, context);
  },

  async decide(
    brandId: string,
    organisationId: string,
    approvalId: string,
    input: MarketingApprovalDecisionInput,
    context: TenantContext,
    requestId?: string,
  ) {
    const scope = await resolveBrandScope(brandId, organisationId, context);
    const approval = await getApprovalOrThrow(scope, approvalId);

    if (approval.status !== "PENDING") {
      throw new AppError("VALIDATION_ERROR", "Only pending approvals can be decided.");
    }

    assertCanDecide({
      requesterUserId: approval.requesterUserId,
      deciderUserId: context.userProfileId,
    });

    const decisionStatus = input.decision as MarketingApprovalStatus;

    await prisma.$transaction([
      // Immutable decision record — no updatedAt, append-only
      prisma.marketingApprovalDecision.create({
        data: {
          organisationId: scope.organisationId,
          approvalRequestId: approvalId,
          decision: decisionStatus,
          deciderUserId: context.userProfileId,
          feedback: input.feedback ?? null,
        },
      }),
      prisma.marketingApprovalRequest.update({
        where: { id: approvalId },
        data: { status: decisionStatus },
      }),
    ]);

    await recordAuditEvent({
      organisationId: scope.organisationId,
      projectId: scope.projectId,
      actorUserId: context.userProfileId,
      action: `marketingApproval.${input.decision.toLowerCase()}`,
      resourceType: "marketingApprovalRequest",
      resourceId: approvalId,
      requestId,
    });

    return this.getById(brandId, organisationId, approvalId, context);
  },

  async getInbox(brandId: string, organisationId: string, context: TenantContext) {
    return this.list(brandId, organisationId, context, { pendingOnly: true });
  },
};
