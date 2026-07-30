import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { tikTokAdsAdapter } from "@/lib/advertising-tiktok-ads/adapter";
import { REQUIRED_LAUNCH_APPROVAL_TYPES } from "@/lib/advertising-tiktok-ads/constants";
import { classifyTikTokLaunchError } from "@/lib/advertising-tiktok-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-tiktok-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-tiktok-ads/launch-approval";
import type { MutationOperation } from "@/lib/advertising-tiktok-ads/mutation-plan";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingTikTokAdsLaunchService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingTikTokAdsLaunch.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true } }, mutationPlan: { select: { id: true, planHash: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getById(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const launch = await prisma.advertisingTikTokAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: {
        plan: true,
        draft: true,
        mutationPlan: { include: { launchApprovals: true } },
        tikTokAdsAccount: true,
        providerResources: true,
        marketingCampaign: true,
      },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");
    return launch;
  },

  async requestApprovals(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingTikTokAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approvals = [];
    for (const approvalType of REQUIRED_LAUNCH_APPROVAL_TYPES) {
      const existing = await prisma.advertisingTikTokAdsLaunchApproval.findFirst({ where: { mutationPlanId, approvalType } });
      approvals.push(
        existing
          ? await prisma.advertisingTikTokAdsLaunchApproval.update({
              where: { id: existing.id },
              data: { planHash: plan.planHash, decision: "PENDING", approverUserId: null, approvedAt: null },
            })
          : await prisma.advertisingTikTokAdsLaunchApproval.create({
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
    const plan = await prisma.advertisingTikTokAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approval = await prisma.advertisingTikTokAdsLaunchApproval.findFirst({
      where: { mutationPlanId, approvalType: input.approvalType },
    });
    if (!approval) throw new AppError("NOT_FOUND", "Approval gate not found.");
    if (approval.planHash !== plan.planHash) {
      throw new AppError("VALIDATION_ERROR", "Approval is stale — mutation plan has changed.");
    }

    return prisma.advertisingTikTokAdsLaunchApproval.update({
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
    const mutationPlan = await prisma.advertisingTikTokAdsMutationPlan.findFirst({
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

    const launchVersion = (await prisma.advertisingTikTokAdsLaunch.count({ where: { mutationPlanId } })) + 1;
    const idempotencyKey = buildLaunchIdempotencyKey(mutationPlan.draft.planId, mutationPlan.planHash, launchVersion);

    const existing = await prisma.advertisingTikTokAdsLaunch.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "LAUNCHED") return existing;

    return prisma.advertisingTikTokAdsLaunch.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId: mutationPlan.draft.planId,
        draftId: mutationPlan.draftId,
        mutationPlanId,
        tikTokAdsAccountId: mutationPlan.draft.tikTokAdsAccountId,
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

    const existingResources = await prisma.advertisingTikTokAdsProviderResource.count({
      where: { launchId, status: "CREATED" },
    });
    if (existingResources > 0) {
      return prisma.advertisingTikTokAdsLaunch.findUnique({ where: { id: launchId }, include: { providerResources: true } });
    }

    await prisma.advertisingTikTokAdsLaunch.update({ where: { id: launchId }, data: { status: "LAUNCHING" } });

    const account = launch.tikTokAdsAccount;
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "TikTok tokens unavailable.");

    const operations = launch.mutationPlan.operations as MutationOperation[];

    try {
      const { resourceMap, providerResponse } = await tikTokAdsAdapter.executeApprovedPlan(
        tokens.accessToken,
        account.advertiserId,
        operations,
      );

      for (const [internalRef, providerId] of resourceMap.entries()) {
        const op = operations.find((o) => o.internalRef === internalRef);
        await prisma.advertisingTikTokAdsProviderResource.create({
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
            where: { brandId_provider_providerCampaignId: { brandId, provider: "TIKTOK", providerCampaignId: campaignId } },
            create: {
              organisationId,
              projectId: launch.projectId,
              brandId,
              provider: "TIKTOK",
              providerCampaignId: campaignId,
              name: launch.plan.name,
              status: "ACTIVE",
              campaignType: launch.draft.objective ?? "TRAFFIC",
              providerMetadata: { launchId, mutationPlanHash: launch.planHash } as Prisma.InputJsonValue,
            },
            update: {
              providerMetadata: { launchId, mutationPlanHash: launch.planHash } as Prisma.InputJsonValue,
              lastSeenAt: new Date(),
            },
          })
        : null;

      return prisma.advertisingTikTokAdsLaunch.update({
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
      const recovery = classifyTikTokLaunchError(error);
      await prisma.advertisingTikTokAdsLaunch.update({
        where: { id: launchId },
        data: {
          status: recovery.code === "CREATIVE_REJECTED" ? "POLICY_REJECTED" : "FAILED",
          policyRejectionReason: recovery.code === "CREATIVE_REJECTED" ? recovery.message : undefined,
          errorDetails: recovery as unknown as Prisma.InputJsonValue,
        },
      });
      throw new AppError("INTERNAL_ERROR", recovery.message);
    }
  },
};
