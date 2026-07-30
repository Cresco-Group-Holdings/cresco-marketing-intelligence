import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { tikTokAdsAdapter } from "@/lib/advertising-tiktok-ads/adapter";
import { evaluateBudgetGuardrails } from "@/lib/advertising-tiktok-ads/budget-guardrails";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingTikTokAdsManagementService = {
  async listCampaigns(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    return prisma.advertisingTikTokAdsLaunch.findMany({
      where: { organisationId, brandId, status: "LAUNCHED" },
      include: { providerResources: true, marketingCampaign: true },
      orderBy: { launchedAt: "desc" },
      take: 50,
    });
  },

  async previewPause(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const launch = await prisma.advertisingTikTokAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { tikTokAdsAccount: true, providerResources: true },
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
    const launch = await prisma.advertisingTikTokAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { tikTokAdsAccount: true },
    });
    if (!launch || !preview.providerCampaignId) throw new AppError("NOT_FOUND", "Campaign not found.");

    const tokens = await connectorCredentialService.readTokens(launch.tikTokAdsAccount.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "TikTok tokens unavailable.");

    const result = await tikTokAdsAdapter.pauseCampaign(
      tokens.accessToken,
      launch.tikTokAdsAccount.advertiserId,
      preview.providerCampaignId,
    );

    await prisma.advertisingTikTokAdsOperation.create({
      data: {
        organisationId,
        brandId,
        tikTokAdsAccountId: launch.tikTokAdsAccountId,
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

  async previewResume(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const preview = await this.previewPause(launchId, brandId, organisationId, context);
    return { ...preview, operation: "RESUME_CAMPAIGN", preview: { message: "Campaign will be resumed." } };
  },

  async confirmResume(launchId: string, brandId: string, organisationId: string, context: TenantContext) {
    const preview = await this.previewPause(launchId, brandId, organisationId, context);
    const launch = await prisma.advertisingTikTokAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { tikTokAdsAccount: true },
    });
    if (!launch || !preview.providerCampaignId) throw new AppError("NOT_FOUND", "Campaign not found.");

    const tokens = await connectorCredentialService.readTokens(launch.tikTokAdsAccount.connectorAccountId);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "TikTok tokens unavailable.");

    const result = await tikTokAdsAdapter.resumeCampaign(
      tokens.accessToken,
      launch.tikTokAdsAccount.advertiserId,
      preview.providerCampaignId,
    );

    await prisma.advertisingTikTokAdsOperation.create({
      data: {
        organisationId,
        brandId,
        tikTokAdsAccountId: launch.tikTokAdsAccountId,
        launchId,
        providerCampaignId: preview.providerCampaignId,
        operationType: "RESUME_CAMPAIGN",
        status: "SUCCEEDED",
        reason: "User-initiated resume",
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
    const launch = await prisma.advertisingTikTokAdsLaunch.findFirst({
      where: { id: launchId, organisationId, brandId },
      include: { tikTokAdsAccount: true, mutationPlan: true },
    });
    if (!launch) throw new AppError("NOT_FOUND", "Launch not found.");

    const budgetSummary = launch.mutationPlan.budgetSummary as { dailyBudgetCents?: number; currency?: string } | null;
    const guardrails = evaluateBudgetGuardrails({
      approvedDailyBudgetCents: budgetSummary?.dailyBudgetCents ?? 0,
      proposedDailyBudgetCents,
      currency: budgetSummary?.currency ?? "USD",
      accountCurrency: launch.tikTokAdsAccount.currency ?? "USD",
    });

    return { allowed: guardrails.allowed, violations: guardrails.violations, requiresReapproval: !guardrails.allowed };
  },
};
