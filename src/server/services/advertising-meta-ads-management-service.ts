import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { evaluateBudgetGuardrails } from "@/lib/advertising-meta-ads/budget-guardrails";
import { metaAdsMutateClient } from "@/lib/meta-ads/mutate-client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { advertisingMetaAdsAccountService } from "@/server/services/advertising-meta-ads-account-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingMetaAdsManagementService = {
  async previewPause(
    brandId: string,
    organisationId: string,
    input: { providerCampaignId: string; reason: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await advertisingMetaAdsAccountService.requireAccount(brandId, organisationId, context);
    return {
      operationType: "PAUSE_CAMPAIGN",
      providerCampaignId: input.providerCampaignId,
      reason: input.reason,
      preview: { action: "Set campaign status to PAUSED", accountId: account.adAccountId },
    };
  },

  async confirmPause(
    brandId: string,
    organisationId: string,
    input: { providerCampaignId: string; reason: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await advertisingMetaAdsAccountService.requireAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Meta tokens unavailable.");

    const operation = await prisma.advertisingMetaAdsOperation.create({
      data: {
        organisationId,
        brandId,
        metaAdsAccountId: account.id,
        providerCampaignId: input.providerCampaignId,
        operationType: "PAUSE_CAMPAIGN",
        status: "CONFIRMED",
        reason: input.reason,
        preview: { action: "PAUSE" } as Prisma.InputJsonValue,
        requestedByUserId: context.userProfileId,
      },
    });

    try {
      const result = await metaAdsMutateClient.updateCampaignStatus(tokens.accessToken, input.providerCampaignId, "PAUSED");
      return prisma.advertisingMetaAdsOperation.update({
        where: { id: operation.id },
        data: { status: "SUCCEEDED", executedAt: new Date(), providerResult: result as unknown as Prisma.InputJsonValue },
      });
    } catch (error) {
      await prisma.advertisingMetaAdsOperation.update({
        where: { id: operation.id },
        data: { status: "FAILED", providerResult: { error: String(error) } as Prisma.InputJsonValue },
      });
      throw error;
    }
  },

  async previewResume(
    brandId: string,
    organisationId: string,
    input: { providerCampaignId: string; reason: string },
    context: TenantContext,
  ) {
    await advertisingMetaAdsAccountService.requireAccount(brandId, organisationId, context);
    return { operationType: "RESUME_CAMPAIGN", preview: { action: "Set campaign status to ACTIVE" }, reason: input.reason };
  },

  async previewBudget(
    brandId: string,
    organisationId: string,
    input: { proposedDailyCents: number; approvedMaxDailyCents: number; planCurrency: string; reason: string },
    context: TenantContext,
  ) {
    const account = await advertisingMetaAdsAccountService.requireAccount(brandId, organisationId, context);
    const guardrails = evaluateBudgetGuardrails({
      proposedDailyCents: input.proposedDailyCents,
      approvedMaxDailyCents: input.approvedMaxDailyCents,
      accountCurrency: account.currency ?? input.planCurrency,
      planCurrency: input.planCurrency,
    });
    return { operationType: "ADJUST_BUDGET", guardrails, reason: input.reason };
  },

  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingMetaAdsLaunch.findMany({
      where: { organisationId, brandId, status: "LAUNCHED" },
      include: { marketingCampaign: true, providerResources: true },
      orderBy: { launchedAt: "desc" },
    });
  },
};
