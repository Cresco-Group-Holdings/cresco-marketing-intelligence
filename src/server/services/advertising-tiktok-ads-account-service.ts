import { prisma } from "@/lib/database/prisma";
import { tikTokAdsAdapter } from "@/lib/advertising-tiktok-ads/adapter";
import { TIKTOK_ADS_CAPABILITIES, getDisabledCapabilities } from "@/lib/advertising-providers/capability-gates";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingTikTokAdsAccountService = {
  async getStatus(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const connection = await paidAdsConnectionService.getConnectionStatus(brandId, organisationId, "TIKTOK", context);
    const assigned = await prisma.advertisingTikTokAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: { select: { id: true, status: true, externalAccountId: true } } },
    });
    return {
      connection,
      assigned,
      capabilities: TIKTOK_ADS_CAPABILITIES,
      disabledCapabilities: getDisabledCapabilities(TIKTOK_ADS_CAPABILITIES),
    };
  },

  async listAssets(brandId: string, organisationId: string, context: TenantContext) {
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "TIKTOK", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "TikTok Ads is not connected.");

    const accounts = await tikTokAdsAdapter.listAccounts(tokens.accessToken);
    const adAccounts = await paidAdsConnectionService.listAdAccounts(brandId, organisationId, "TIKTOK", context);
    let assets: Awaited<ReturnType<typeof tikTokAdsAdapter.listAssets>> = [];
    if (connectorAccount.externalAccountId) {
      assets = await tikTokAdsAdapter.listAssets(tokens.accessToken, connectorAccount.externalAccountId).catch(() => []);
    }
    return { accounts, adAccounts, assets };
  },

  async assignAccount(
    brandId: string,
    organisationId: string,
    input: { advertiserId: string; advertiserName?: string; pixelId?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "TIKTOK", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "TikTok Ads is not connected.");
    if (!input.advertiserId) throw new AppError("VALIDATION_ERROR", "Advertiser must be explicitly selected.");

    const details = await tikTokAdsAdapter.validateAccount(tokens.accessToken, input.advertiserId);

    return prisma.advertisingTikTokAdsAccount.upsert({
      where: { brandId },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        connectorAccountId: connectorAccount.id,
        advertiserId: input.advertiserId,
        advertiserName: input.advertiserName ?? details.accountName,
        pixelId: input.pixelId,
        currency: details.currency,
        timezone: details.timezone,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
      },
      update: {
        advertiserId: input.advertiserId,
        advertiserName: input.advertiserName ?? details.accountName,
        pixelId: input.pixelId,
        currency: details.currency,
        timezone: details.timezone,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
        disconnectedAt: null,
      },
    });
  },

  async disconnect(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingTikTokAdsAccount.findUnique({ where: { brandId } });
    if (!account) throw new AppError("NOT_FOUND", "No TikTok Ads account assigned.");
    return prisma.advertisingTikTokAdsAccount.update({
      where: { id: account.id },
      data: { status: "DISCONNECTED", disconnectedAt: new Date() },
    });
  },

  async requireAccount(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingTikTokAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: true },
    });
    if (!account || account.status !== "CONNECTED") {
      throw new AppError("VALIDATION_ERROR", "Connected TikTok Ads account is required.");
    }
    if (!account.advertiserId) {
      throw new AppError("VALIDATION_ERROR", "TikTok advertiser must be selected.");
    }
    return account;
  },
};
