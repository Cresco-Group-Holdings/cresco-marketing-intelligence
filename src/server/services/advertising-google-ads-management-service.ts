import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { currencyToMicros, evaluateBudgetGuardrails } from "@/lib/advertising-google-ads/budget-guardrails";
import { googleAdsMutateClient } from "@/lib/google-ads/mutate-client";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { advertisingGoogleAdsAccountService } from "@/server/services/advertising-google-ads-account-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingGoogleAdsManagementService = {
  async previewPause(
    brandId: string,
    organisationId: string,
    input: { providerCampaignId: string; reason: string },
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await advertisingGoogleAdsAccountService.requireAccount(brandId, organisationId, context);
    return {
      operationType: "PAUSE_CAMPAIGN",
      providerCampaignId: input.providerCampaignId,
      reason: input.reason,
      preview: {
        action: "Set campaign status to PAUSED",
        accountId: account.customerId,
        risks: ["Campaign will stop serving immediately."],
      },
    };
  },

  async confirmPause(
    brandId: string,
    organisationId: string,
    input: { providerCampaignId: string; reason: string; providerResourceName: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await advertisingGoogleAdsAccountService.requireAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google Ads tokens unavailable.");

    const operation = await prisma.advertisingGoogleAdsOperation.create({
      data: {
        organisationId,
        brandId,
        googleAdsAccountId: account.id,
        providerCampaignId: input.providerCampaignId,
        operationType: "PAUSE_CAMPAIGN",
        status: "CONFIRMED",
        reason: input.reason,
        preview: { action: "PAUSE" } as Prisma.InputJsonValue,
        requestedByUserId: context.userProfileId,
      },
    });

    try {
      const result = await googleAdsMutateClient.updateCampaignStatus(
        tokens.accessToken,
        account.customerId,
        input.providerResourceName,
        "PAUSED",
        account.managerCustomerId ?? undefined,
      );
      return prisma.advertisingGoogleAdsOperation.update({
        where: { id: operation.id },
        data: {
          status: "SUCCEEDED",
          executedAt: new Date(),
          providerResult: result as unknown as Prisma.InputJsonValue,
          confirmation: { confirmed: true } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await prisma.advertisingGoogleAdsOperation.update({
        where: { id: operation.id },
        data: {
          status: "FAILED",
          providerResult: { error: error instanceof Error ? error.message : "Unknown" } as Prisma.InputJsonValue,
        },
      });
      throw error;
    }
  },

  async previewBudgetAdjust(
    brandId: string,
    organisationId: string,
    input: {
      proposedDailyAmount: number;
      approvedMaxDailyAmount: number;
      currentDailyAmount?: number;
      planCurrency: string;
      reason: string;
    },
    context: TenantContext,
  ) {
    const account = await advertisingGoogleAdsAccountService.requireAccount(brandId, organisationId, context);
    const guardrails = evaluateBudgetGuardrails({
      proposedDailyMicros: currencyToMicros(input.proposedDailyAmount),
      approvedMaxDailyMicros: currencyToMicros(input.approvedMaxDailyAmount),
      currentDailyMicros: input.currentDailyAmount ? currencyToMicros(input.currentDailyAmount) : undefined,
      accountCurrency: account.currency ?? input.planCurrency,
      planCurrency: input.planCurrency,
    });

    return {
      operationType: "ADJUST_BUDGET",
      guardrails,
      preview: {
        proposedDailyAmount: input.proposedDailyAmount,
        currency: input.planCurrency,
        allowed: guardrails.allowed,
      },
      reason: input.reason,
    };
  },

  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingGoogleAdsLaunch.findMany({
      where: { organisationId, brandId, status: "LAUNCHED" },
      include: {
        marketingCampaign: true,
        providerResources: { where: { resourceType: "CAMPAIGN" } },
      },
      orderBy: { launchedAt: "desc" },
    });
  },
};
