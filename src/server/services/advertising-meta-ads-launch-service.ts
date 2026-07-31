import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildCapiEventId, buildCapiPayload, shouldSkipCapi } from "@/lib/advertising-meta-ads/capi";
import { REQUIRED_LAUNCH_APPROVAL_TYPES } from "@/lib/advertising-meta-ads/constants";
import { classifyMetaLaunchError } from "@/lib/advertising-meta-ads/error-recovery";
import { buildLaunchIdempotencyKey } from "@/lib/advertising-meta-ads/idempotency";
import { evaluateLaunchApprovals } from "@/lib/advertising-meta-ads/launch-approval";
import type { MutationOperation } from "@/lib/advertising-meta-ads/mutation-plan";
import { metaAdsMutateClient } from "@/lib/meta-ads/mutate-client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingMetaAdsLaunchService = {
  async list(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingMetaAdsLaunch.findMany({
      where: { organisationId, brandId },
      include: { plan: { select: { id: true, name: true } }, mutationPlan: { select: { id: true, planHash: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async getById(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const launch = await prisma.advertisingMetaAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: {
        plan: true,
        draft: true,
        mutationPlan: { include: { launchApprovals: true } },
        metaAdsAccount: true,
        providerResources: true,
        marketingCampaign: true,
      },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");
    return launch;
  },

  async requestApprovals(mutationPlanId: string, brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const plan = await prisma.advertisingMetaAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approvals = [];
    for (const approvalType of REQUIRED_LAUNCH_APPROVAL_TYPES) {
      const existing = await prisma.advertisingMetaAdsLaunchApproval.findFirst({
        where: { mutationPlanId, approvalType },
      });
      approvals.push(
        existing ?
          await prisma.advertisingMetaAdsLaunchApproval.update({
            where: { id: existing.id },
            data: { planHash: plan.planHash, decision: "PENDING", approverUserId: null, approvedAt: null },
          })
        : await prisma.advertisingMetaAdsLaunchApproval.create({
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
    const plan = await prisma.advertisingMetaAdsMutationPlan.findFirst({
      where: { id: mutationPlanId, organisationId },
      include: { draft: true },
    });
    if (!plan || plan.draft.brandId !== brandId) throw new AppError("NOT_FOUND", "Mutation plan not found.");

    const approval = await prisma.advertisingMetaAdsLaunchApproval.findFirst({
      where: { mutationPlanId, approvalType: input.approvalType },
    });
    if (!approval) throw new AppError("NOT_FOUND", "Approval gate not found.");
    if (approval.planHash !== plan.planHash) {
      throw new AppError("VALIDATION_ERROR", "Approval is stale — mutation plan has changed.");
    }

    return prisma.advertisingMetaAdsLaunchApproval.update({
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
    const mutationPlan = await prisma.advertisingMetaAdsMutationPlan.findFirst({
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

    const launchVersion = (await prisma.advertisingMetaAdsLaunch.count({ where: { mutationPlanId } })) + 1;
    const idempotencyKey = buildLaunchIdempotencyKey(mutationPlan.draft.planId, mutationPlan.planHash, launchVersion);

    const existing = await prisma.advertisingMetaAdsLaunch.findUnique({ where: { idempotencyKey } });
    if (existing?.status === "LAUNCHED") return existing;

    return prisma.advertisingMetaAdsLaunch.create({
      data: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        planId: mutationPlan.draft.planId,
        draftId: mutationPlan.draftId,
        mutationPlanId,
        metaAdsAccountId: mutationPlan.draft.metaAdsAccountId,
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

    const existingResources = await prisma.advertisingMetaAdsProviderResource.count({
      where: { launchId, status: "CREATED" },
    });
    if (existingResources > 0) {
      return prisma.advertisingMetaAdsLaunch.findUnique({ where: { id: launchId }, include: { providerResources: true } });
    }

    await prisma.advertisingMetaAdsLaunch.update({ where: { id: launchId }, data: { status: "LAUNCHING" } });

    const account = launch.metaAdsAccount;
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Meta tokens unavailable.");

    const operations = launch.mutationPlan.operations as MutationOperation[];
    const resourceMap = new Map<string, string>();

    try {
      for (const op of operations) {
        if (op.resourceType === "CAMPAIGN") {
          const response = await metaAdsMutateClient.createCampaign(tokens.accessToken, account.adAccountId, op.payload);
          if (!response.id) throw new AppError("INTERNAL_ERROR", "Failed to create Meta campaign.");
          resourceMap.set(op.internalRef, response.id);
          await prisma.advertisingMetaAdsProviderResource.create({
            data: {
              organisationId,
              launchId,
              resourceType: "CAMPAIGN",
              internalRef: op.internalRef,
              providerResourceId: response.id,
              status: "CREATED",
              providerResponse: response as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      for (const op of operations) {
        if (op.resourceType === "AD_SET") {
          const payload = { ...op.payload };
          if (payload.campaign_id === "{{campaign:primary}}") {
            payload.campaign_id = resourceMap.get("campaign:primary");
          }
          const response = await metaAdsMutateClient.createAdSet(tokens.accessToken, account.adAccountId, payload);
          if (!response.id) throw new AppError("INTERNAL_ERROR", "Failed to create ad set.");
          resourceMap.set(op.internalRef, response.id);
          await prisma.advertisingMetaAdsProviderResource.create({
            data: {
              organisationId,
              launchId,
              resourceType: "AD_SET",
              internalRef: op.internalRef,
              providerResourceId: response.id,
              status: "CREATED",
              providerResponse: response as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      const campaignId = resourceMap.get("campaign:primary");
      const marketingCampaign = campaignId ?
        await prisma.marketingCampaign.upsert({
          where: {
            brandId_provider_providerCampaignId: { brandId, provider: "META", providerCampaignId: campaignId },
          },
          create: {
            organisationId,
            projectId: launch.projectId,
            brandId,
            provider: "META",
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

      return prisma.advertisingMetaAdsLaunch.update({
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
      const recovery = classifyMetaLaunchError({
        message: error instanceof Error ? error.message : "Launch failed",
        policyRejected: String(error).includes("policy"),
        duplicateResource: existingResources > 0,
      });
      await prisma.advertisingMetaAdsLaunch.update({
        where: { id: launchId },
        data: {
          status: recovery.kind === "POLICY_REJECTION" ? "POLICY_REJECTED" : "FAILED",
          policyRejectionReason: recovery.kind === "POLICY_REJECTION" ? recovery.message : undefined,
          errorDetails: recovery as unknown as Prisma.InputJsonValue,
        },
      });
      throw new AppError("INTERNAL_ERROR", recovery.message);
    }
  },

  async listOperations(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingMetaAdsOperation.findMany({
      where: { organisationId, brandId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },
};

export const advertisingMetaAdsCapiService = {
  async queueEvent(
    brandId: string,
    organisationId: string,
    input: {
      eventName: string;
      eventTime: string;
      browserEventId?: string;
      consentState: "GRANTED" | "DENIED" | "UNKNOWN";
      email?: string;
      phone?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingMetaAdsAccount.findUnique({ where: { brandId } });
    if (!account?.pixelId) throw new AppError("VALIDATION_ERROR", "Pixel must be configured for CAPI events.");

    const eventTime = new Date(input.eventTime);
    const eventId = buildCapiEventId({ eventName: input.eventName, browserEventId: input.browserEventId, eventTime });

    if (shouldSkipCapi(input.consentState)) {
      return prisma.advertisingMetaAdsCapiEvent.create({
        data: {
          organisationId,
          brandId,
          metaAdsAccountId: account.id,
          eventName: input.eventName,
          eventId,
          eventTime,
          consentState: input.consentState,
          browserEventId: input.browserEventId,
          status: "SKIPPED_NO_CONSENT",
        },
      });
    }

    const existing = await prisma.advertisingMetaAdsCapiEvent.findUnique({
      where: { metaAdsAccountId_eventId: { metaAdsAccountId: account.id, eventId } },
    });
    if (existing) return existing;

    const payload = buildCapiPayload(
      {
        eventName: input.eventName,
        eventTime,
        browserEventId: input.browserEventId,
        consentState: input.consentState,
        email: input.email,
        phone: input.phone,
      },
      eventId,
    );

    const record = await prisma.advertisingMetaAdsCapiEvent.create({
      data: {
        organisationId,
        brandId,
        metaAdsAccountId: account.id,
        eventName: input.eventName,
        eventId,
        eventTime,
        consentState: input.consentState,
        browserEventId: input.browserEventId,
        hashedUserData: payload?.user_data as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (tokens?.accessToken && payload) {
      try {
        const response = await metaAdsMutateClient.sendCapiEvent(tokens.accessToken, account.pixelId, payload);
        return prisma.advertisingMetaAdsCapiEvent.update({
          where: { id: record.id },
          data: { status: "SENT", providerResponse: response as unknown as Prisma.InputJsonValue },
        });
      } catch (error) {
        return prisma.advertisingMetaAdsCapiEvent.update({
          where: { id: record.id },
          data: {
            status: "FAILED",
            providerResponse: { error: error instanceof Error ? error.message : "send failed" } as Prisma.InputJsonValue,
          },
        });
      }
    }

    return record;
  },
};
