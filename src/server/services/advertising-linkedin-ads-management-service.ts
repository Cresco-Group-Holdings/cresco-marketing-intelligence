import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { linkedInAdsAdapter } from "@/lib/advertising-linkedin-ads/adapter";
import { evaluateBudgetGuardrails } from "@/lib/advertising-linkedin-ads/budget-guardrails";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingLinkedInAdsManagementService = {
  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingLinkedInAdsLaunch.findMany({
      where: { organisationId, brandId, status: "LAUNCHED" },
      include: { providerResources: true, marketingCampaign: true },
      orderBy: { launchedAt: "desc" },
      take: 50,
    });
  },

  async previewPause(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const launch = await prisma.advertisingLinkedInAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { linkedInAdsAccount: true, providerResources: true },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");
    const campaignResource = launch.providerResources.find((r) => r.resourceType === "CAMPAIGN");
    return {
      operation: "PAUSE_CAMPAIGN",
      providerCampaignId: campaignResource?.providerResourceId,
      preview: { message: "Campaign will be paused. No autonomous changes." },
    };
  },

  async confirmPause(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const preview = await this.previewPause(launchId, brandId, organisationId, context);
    const launch = await prisma.advertisingLinkedInAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { linkedInAdsAccount: true },
    });
    if (!launch || !preview.providerCampaignId) throw new AppError("NOT_FOUND", "Campaign not found.");

    const tokens = await connectorCredentialService.readTokens(launch.linkedInAdsAccount.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "LinkedIn tokens unavailable.");

    const result = await linkedInAdsAdapter.pauseCampaign(
      tokens.accessToken,
      launch.linkedInAdsAccount.linkedInAccountId,
      preview.providerCampaignId,
    );

    await prisma.advertisingLinkedInAdsOperation.create({
      data: {
        organisationId,
        brandId,
        linkedInAdsAccountId: launch.linkedInAdsAccountId,
        launchId,
        providerCampaignId: preview.providerCampaignId,
        operationType: "PAUSE_CAMPAIGN",
        status: "SUCCEEDED",
        reason: "User-initiated pause",
        providerResult: result as Prisma.InputJsonValue,
        requestedByUserId: context.userProfileId,
        executedAt: new Date(),
      },
    });

    return { success: true, result };
  },

  async previewBudget(
    launchId: string,
    brandId: string,
    organisationId: string,
    proposedDailyBudgetCents: number,
    context: TenantContext,
  ) {
    const launch = await prisma.advertisingLinkedInAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { linkedInAdsAccount: true, mutationPlan: true },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");

    const budgetSummary = launch.mutationPlan.budgetSummary as { dailyBudgetCents?: number; currency?: string } | null;
    const guardrails = evaluateBudgetGuardrails({
      approvedDailyBudgetCents: budgetSummary?.dailyBudgetCents ?? 0,
      proposedDailyBudgetCents,
      currency: budgetSummary?.currency ?? "USD",
      accountCurrency: launch.linkedInAdsAccount.currency ?? "USD",
    });

    return { allowed: guardrails.allowed, violations: guardrails.violations, requiresReapproval: !guardrails.allowed };
  },
};
