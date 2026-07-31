import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { evaluateLaunchApprovals } from "@/lib/advertising-google-ads/launch-approval";
import { REQUIRED_LAUNCH_APPROVAL_TYPES } from "@/lib/advertising-google-ads/constants";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-google-ads/idempotency";
import type { MutationOperation } from "@/lib/advertising-google-ads/mutation-plan";
import { classifyLaunchError } from "@/lib/advertising-google-ads/error-recovery";
import { googleAdsMutateClient } from "@/lib/google-ads/mutate-client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { advertisingGoogleAdsDraftService } from "@/server/services/advertising-google-ads-draft-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingGoogleAdsLaunchService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingGoogleAdsLaunch.findMany({
      where: { organisationId, brandId },
      include: {
        plan: { select: { id: true, name: true } },
        mutationPlan: { select: { id: true, planHash: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getById(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const launch = await prisma.advertisingGoogleAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: {
        plan: true,
        draft: true,
        mutationPlan: { include: { launchApprovals: true } },
        googleAdsAccount: true,
        providerResources: true,
        marketingCampaign: true,
      },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");
    return launch;
  },

  async requestApprovals(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingGoogleAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approvals = [];
    for (const approvalType of REQUIRED_LAUNCH_APPROVAL_TYPES) {
      const existing = await prisma.advertisingGoogleAdsLaunchApproval.findFirst({
        where: { mutationPlanId, approvalType },
      });
      if (existing) {
        approvals.push(
          await prisma.advertisingGoogleAdsLaunchApproval.update({
            where: { id: existing.id },
            data: { planHash: plan.planHash, decision: "PENDING", approverUserId: null, approvedAt: null },
          }),
        );
      } else {
        approvals.push(
          await prisma.advertisingGoogleAdsLaunchApproval.create({
            data: {
              organisationId,
              mutationPlanId,
              approvalType,
              planHash: plan.planHash,
              decision: "PENDING",
            },
          }),
        );
      }
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
    const plan = await prisma.advertisingGoogleAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approval = await prisma.advertisingGoogleAdsLaunchApproval.findFirst({
      where: { mutationPlanId, approvalType: input.approvalType },
    });
    if (!approval) throw new AppError("NOT_FOUND", "Approval gate not found.");
    if (approval.planHash !== plan.planHash) {
      throw new AppError("VALIDATION_ERROR", "Approval is stale — mutation plan has changed.");
    }

    return prisma.advertisingGoogleAdsLaunchApproval.update({
      where: { id: approval.id },
      data: {
        decision: input.decision,
        notes: input.notes,
        approverUserId: context.userProfileId,
        approvedAt: input.decision === "APPROVED" ? new Date() : null,
      },
    });
  },

  async validateMutationPlan(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    const plan = await prisma.advertisingGoogleAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: { include: { googleAdsAccount: { include: { connectorAccount: true } } } } },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const account = plan.draft.googleAdsAccount;
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google Ads tokens unavailable.");

    const operations = plan.operations as MutationOperation[];
    const budgetOp = operations.find((o) => o.resourceType === "CAMPAIGN_BUDGET");
    if (!budgetOp) throw new AppError("VALIDATION_ERROR", "No budget operation in mutation plan.");

    const result = await googleAdsMutateClient.validateCampaignBudget(
      tokens.accessToken,
      account.customerId,
      [{ create: budgetOp.payload }],
      account.managerCustomerId ?? undefined,
    );

    await prisma.advertisingGoogleAdsMutationPlan.update({
      where: { id: plan.id },
      data: {
        validationStatus: "PASSED",
        validationResult: result as unknown as Prisma.InputJsonValue,
      },
    });

    return { valid: true, result };
  },

  async createLaunch(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const mutationPlan = await prisma.advertisingGoogleAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: {
        draft: { include: { googleAdsAccount: true, plan: true } },
        launchApprovals: true,
      },
    });
    if (!mutationPlan || mutationPlan.draft.brandId !== brandId) {
      throw new AppError("NOT_FOUND", "Mutation plan not found.");
    }

    const gate = evaluateLaunchApprovals(
      mutationPlan.launchApprovals.map((a) => ({
        approvalType: a.approvalType,
        decision: a.decision,
        planHash: a.planHash,
        approvedAt: a.approvedAt,
      })),
      mutationPlan.planHash,
    );

    if (!gate.complete) {
      throw new AppError("VALIDATION_ERROR", `Launch approvals incomplete: pending=${gate.pending.join(",")} stale=${gate.stale.join(",")}`);
    }

    const launchVersion = (await prisma.advertisingGoogleAdsLaunch.count({ where: { mutationPlanId } })) + 1;
    const idempotencyKey = buildLaunchIdempotencyKey(mutationPlan.draft.planId, mutationPlan.planHash, launchVersion);

    const existing = await prisma.advertisingGoogleAdsLaunch.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "LAUNCHED") {
      return existing;
    }

    return prisma.advertisingGoogleAdsLaunch.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId: mutationPlan.draft.planId,
        draftId: mutationPlan.draftId,
        mutationPlanId,
        googleAdsAccountId: mutationPlan.draft.googleAdsAccountId,
        planHash: mutationPlan.planHash,
        launchVersion,
        status: "APPROVED",
        idempotencyKey,
      },
    });
  },

  async executeLaunch(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const launch = await this.getById(launchId, brandId, organisationId, context);
    if (launch.planHash !== launch.mutationPlan.planHash) {
      throw new AppError("VALIDATION_ERROR", "Launch approval is stale.");
    }

    const gate = evaluateLaunchApprovals(
      launch.mutationPlan.launchApprovals.map((a) => ({
        approvalType: a.approvalType,
        decision: a.decision,
        planHash: a.planHash,
      })),
      launch.planHash,
    );
    if (!gate.complete) {
      throw new AppError("VALIDATION_ERROR", "All launch approvals must be complete before execution.");
    }

    const existingResources = await prisma.advertisingGoogleAdsProviderResource.count({
      where: { launchId, status: "CREATED" },
    });
    if (existingResources > 0) {
      return prisma.advertisingGoogleAdsLaunch.findUnique({
        where: { id: launchId },
        include: { providerResources: true },
      });
    }

    await prisma.advertisingGoogleAdsLaunch.update({
      where: { id: launchId },
      data: { status: "LAUNCHING" },
    });

    const account = launch.googleAdsAccount;
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google Ads tokens unavailable.");

    const operations = launch.mutationPlan.operations as MutationOperation[];
    const resourceMap = new Map<string, string>();

    try {
      for (const op of operations) {
        if (op.resourceType === "CAMPAIGN_BUDGET") {
          const response = await googleAdsMutateClient.createCampaignBudget(
            tokens.accessToken,
            account.customerId,
            [{ create: op.payload }],
            account.managerCustomerId ?? undefined,
          );
          const resourceName = response.results?.[0]?.resourceName;
          if (!resourceName) throw new AppError("INTERNAL_ERROR", "Failed to create campaign budget.");
          resourceMap.set(op.internalRef, resourceName);
          await prisma.advertisingGoogleAdsProviderResource.create({
            data: {
              organisationId,
              launchId,
              resourceType: "CAMPAIGN_BUDGET",
              internalRef: op.internalRef,
              providerResourceName: resourceName,
              status: "CREATED",
              providerResponse: response as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      for (const op of operations) {
        if (op.resourceType === "CAMPAIGN") {
          const payload = { ...op.payload };
          if (typeof payload.campaignBudget === "string" && payload.campaignBudget.startsWith("{{")) {
            const ref = payload.campaignBudget.replace(/\{\{|\}\}/g, "").split(":")[1];
            payload.campaignBudget = resourceMap.get(`budget:${ref}`) ?? resourceMap.get("budget:primary");
          }
          const response = await googleAdsMutateClient.createCampaigns(
            tokens.accessToken,
            account.customerId,
            [{ create: payload }],
            account.managerCustomerId ?? undefined,
          );
          const resourceName = response.results?.[0]?.resourceName;
          if (!resourceName) throw new AppError("INTERNAL_ERROR", "Failed to create campaign.");
          resourceMap.set(op.internalRef, resourceName);
          await prisma.advertisingGoogleAdsProviderResource.create({
            data: {
              organisationId,
              launchId,
              resourceType: "CAMPAIGN",
              internalRef: op.internalRef,
              providerResourceName: resourceName,
              status: "CREATED",
              providerResponse: response as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      const campaignResource = resourceMap.get("campaign:primary");
      const marketingCampaign = campaignResource ?
        await prisma.marketingCampaign.upsert({
          where: {
            brandId_provider_providerCampaignId: {
              brandId,
              provider: "GOOGLE_ADS",
              providerCampaignId: campaignResource.split("/").pop() ?? launchId,
            },
          },
          create: {
            organisationId,
            projectId: launch.projectId,
            brandId,
            provider: "GOOGLE_ADS",
            providerCampaignId: campaignResource.split("/").pop() ?? launchId,
            name: launch.plan.name,
            status: "ACTIVE",
            campaignType: "SEARCH",
            providerMetadata: {
              launchId,
              mutationPlanHash: launch.planHash,
              providerResourceName: campaignResource,
            } as Prisma.InputJsonValue,
          },
          update: {
            providerMetadata: {
              launchId,
              mutationPlanHash: launch.planHash,
              providerResourceName: campaignResource,
            } as Prisma.InputJsonValue,
            lastSeenAt: new Date(),
          },
        })
      : null;

      return prisma.advertisingGoogleAdsLaunch.update({
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
      const recovery = classifyLaunchError({
        message: error instanceof Error ? error.message : "Launch failed",
        duplicateResource: existingResources > 0,
      });
      await prisma.advertisingGoogleAdsLaunch.update({
        where: { id: launchId },
        data: {
          status: recovery.kind === "PARTIAL_FAILURE" ? "PARTIAL_SUCCESS" : "FAILED",
          errorDetails: recovery as unknown as Prisma.InputJsonValue,
        },
      });
      throw new AppError("INTERNAL_ERROR", recovery.message);
    }
  },

  async listOperations(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingGoogleAdsOperation.findMany({
      where: { organisationId, brandId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};
