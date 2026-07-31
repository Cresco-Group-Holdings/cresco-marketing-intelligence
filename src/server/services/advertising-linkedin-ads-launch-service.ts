import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { linkedInAdsAdapter } from "@/lib/advertising-linkedin-ads/adapter";
import { REQUIRED_LAUNCH_APPROVAL_TYPES } from "@/lib/advertising-linkedin-ads/constants";
import { classifyLinkedInLaunchError } from "@/lib/advertising-linkedin-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-linkedin-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-linkedin-ads/launch-approval";
import type { MutationOperation } from "@/lib/advertising-linkedin-ads/mutation-plan";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingLinkedInAdsLaunchService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingLinkedInAdsLaunch.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true } }, mutationPlan: { select: { id: true, planHash: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getById(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const launch = await prisma.advertisingLinkedInAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: {
        plan: true,
        draft: true,
        mutationPlan: { include: { launchApprovals: true } },
        linkedInAdsAccount: true,
        providerResources: true,
        marketingCampaign: true,
      },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");
    return launch;
  },

  async requestApprovals(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingLinkedInAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approvals = [];
    for (const approvalType of REQUIRED_LAUNCH_APPROVAL_TYPES) {
      const existing = await prisma.advertisingLinkedInAdsLaunchApproval.findFirst({ where: { mutationPlanId, approvalType } });
      approvals.push(
        existing
          ? await prisma.advertisingLinkedInAdsLaunchApproval.update({
              where: { id: existing.id },
              data: { planHash: plan.planHash, decision: "PENDING", approverUserId: null, approvedAt: null },
            })
          : await prisma.advertisingLinkedInAdsLaunchApproval.create({
              data: { organisationId, mutationPlanId, approvalType, planHash: plan.planHash, decision: "PENDING" },
            }),
      );
    }
    return approvals;
  },

  async approveGate(
    mutationPlanId: string,
    brandId: string,
    organisationId: string,
    input: { approvalType: string; decision: "APPROVED" | "REJECTED"; notes?: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingLinkedInAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approval = await prisma.advertisingLinkedInAdsLaunchApproval.findFirst({
      where: { mutationPlanId, approvalType: input.approvalType },
    });
    if (!approval) throw new AppError("NOT_FOUND", "Approval gate not found.");
    if (approval.planHash !== plan.planHash) {
      throw new AppError("VALIDATION_ERROR", "Approval is stale — mutation plan has changed.");
    }

    return prisma.advertisingLinkedInAdsLaunchApproval.update({
      where: { id: approval.id },
      data: {
        decision: input.decision,
        notes: input.notes,
        approverUserId: context.userProfileId,
        approvedAt: input.decision === "APPROVED" ? new Date() : null,
      },
    });
  },

  async createLaunch(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const mutationPlan = await prisma.advertisingLinkedInAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true, launchApprovals: true },
    });
    if (!mutationPlan || mutationPlan.draft.brandId !== brandId) {
      throw new AppError("NOT_FOUND", "Mutation plan not found.");
    }

    const gate = evaluateLaunchApprovals(
      mutationPlan.launchApprovals.map((a) => ({ approvalType: a.approvalType, decision: a.decision, planHash: a.planHash })),
      mutationPlan.planHash,
    );
    if (!gate.complete) {
      throw new AppError("VALIDATION_ERROR", `Launch approvals incomplete: pending=${gate.pending.join(",")}`);
    }

    const launchVersion = (await prisma.advertisingLinkedInAdsLaunch.count({ where: { mutationPlanId } })) + 1;
    const idempotencyKey = buildLaunchIdempotencyKey(mutationPlan.draft.planId, mutationPlan.planHash, launchVersion);

    const existing = await prisma.advertisingLinkedInAdsLaunch.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "LAUNCHED") return existing;

    return prisma.advertisingLinkedInAdsLaunch.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId: mutationPlan.draft.planId,
        draftId: mutationPlan.draftId,
        mutationPlanId,
        linkedInAdsAccountId: mutationPlan.draft.linkedInAdsAccountId,
        planHash: mutationPlan.planHash,
        launchVersion,
        status: "APPROVED",
        idempotencyKey,
      },
    });
  },

  async executeLaunch(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const launch = await this.getById(launchId, brandId, organisationId, context);
    const gate = evaluateLaunchApprovals(
      launch.mutationPlan.launchApprovals.map((a) => ({
        approvalType: a.approvalType,
        decision: a.decision,
        planHash: a.planHash,
      })),
      launch.planHash,
    );
    if (!gate.complete) throw new AppError("VALIDATION_ERROR", "All launch approvals must be complete.");

    const existingResources = await prisma.advertisingLinkedInAdsProviderResource.count({
      where: { launchId, status: "CREATED" },
    });
    if (existingResources > 0) {
      return prisma.advertisingLinkedInAdsLaunch.findUnique({ where: { id: launchId }, include: { providerResources: true } });
    }

    await prisma.advertisingLinkedInAdsLaunch.update({ where: { id: launchId }, data: { status: "LAUNCHING" } });

    const account = launch.linkedInAdsAccount;
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "LinkedIn tokens unavailable.");

    const operations = launch.mutationPlan.operations as MutationOperation[];

    try {
      const { resourceMap, providerResponse } = await linkedInAdsAdapter.executeApprovedPlan(
        tokens.accessToken,
        account.linkedInAccountId,
        operations,
      );

      for (const [internalRef, providerId] of resourceMap.entries()) {
        const op = operations.find((o) => o.internalRef === internalRef);
        await prisma.advertisingLinkedInAdsProviderResource.create({
          data: {
            organisationId,
            launchId,
            resourceType: op?.resourceType ?? "UNKNOWN",
            internalRef,
            providerResourceId: providerId,
            status: "CREATED",
            providerResponse: providerResponse as unknown as Prisma.InputJsonValue,
          },
        });
      }

      const campaignId = resourceMap.get("campaign:primary");
      const marketingCampaign = campaignId
        ? await prisma.marketingCampaign.upsert({
            where: { brandId_provider_providerCampaignId: { brandId, provider: "LINKEDIN", providerCampaignId: campaignId } },
            create: {
              organisationId,
              projectId: launch.projectId,
              brandId,
              provider: "LINKEDIN",
              providerCampaignId: campaignId,
              name: launch.plan.name,
              status: "ACTIVE",
              campaignType: launch.draft.objective ?? "WEBSITE_VISITS",
              providerMetadata: { launchId, mutationPlanHash: launch.planHash } as Prisma.InputJsonValue,
            },
            update: {
              providerMetadata: { launchId, mutationPlanHash: launch.planHash } as Prisma.InputJsonValue,
              lastSeenAt: new Date(),
            },
          })
        : null;

      return prisma.advertisingLinkedInAdsLaunch.update({
        where: { id: launchId },
        data: {
          status: "LAUNCHED",
          launchedAt: new Date(),
          launchedByUserId: context.userProfileId,
          marketingCampaignId: marketingCampaign?.id,
          providerResponse: { resourceMap: Object.fromEntries(resourceMap) } as Prisma.InputJsonValue,
        },
        include: { providerResources: true, marketingCampaign: true },
      });
    } catch (error) {
      const recovery = classifyLinkedInLaunchError(error);
      await prisma.advertisingLinkedInAdsLaunch.update({
        where: { id: launchId },
        data: {
          status: recovery.code === "POLICY_REJECTED" ? "POLICY_REJECTED" : "FAILED",
          policyRejectionReason: recovery.code === "POLICY_REJECTED" ? recovery.message : undefined,
          errorDetails: recovery as unknown as Prisma.InputJsonValue,
        },
      });
      throw new AppError("INTERNAL_ERROR", recovery.message);
    }
  },
};
