import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { metaAdsMutateClient } from "@/lib/meta-ads/mutate-client";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingMetaAdsAccountService = {
  async getStatus(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const connection = await paidAdsConnectionService.getConnectionStatus(brandId, organisationId, "META", context);
    const assigned = await prisma.advertisingMetaAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: { select: { id: true, status: true, externalAccountId: true } } },
    });
    return { connection, assigned };
  },

  async listAssets(brandId: string, organisationId: string, context: TenantContext) {
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "META", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Meta Ads is not connected.");

    const [businesses, adAccounts, pages] = await Promise.all([
      metaAdsMutateClient.listBusinesses(tokens.accessToken).catch(() => []),
      paidAdsConnectionService.listAdAccounts(brandId, organisationId, "META", context),
      metaAdsMutateClient.listPages(tokens.accessToken).catch(() => []),
    ]);

    let pixels: Array<{ id: string; name: string }> = [];
    if (connectorAccount.externalAccountId) {
      pixels = await metaAdsMutateClient.listPixels(tokens.accessToken, connectorAccount.externalAccountId).catch(() => []);
    }

    return { businesses, adAccounts, pages, pixels };
  },

  async assignAssets(
    brandId: string,
    organisationId: string,
    input: {
      adAccountId: string;
      adAccountName?: string;
      businessId?: string;
      businessName?: string;
      facebookPageId: string;
      facebookPageName?: string;
      instagramAccountId?: string;
      instagramUsername?: string;
      pixelId?: string;
      datasetId?: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "META", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Meta Ads is not connected.");

    if (!input.facebookPageId) throw new AppError("VALIDATION_ERROR", "Facebook Page must be explicitly selected.");
    if (!input.adAccountId) throw new AppError("VALIDATION_ERROR", "Ad account must be explicitly selected.");

    const details = await metaAdsMutateClient.getAdAccount(tokens.accessToken, input.adAccountId);

    return prisma.advertisingMetaAdsAccount.upsert({
      where: { brandId },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        connectorAccountId: connectorAccount.id,
        businessId: input.businessId,
        businessName: input.businessName,
        adAccountId: input.adAccountId.replace(/^act_/, ""),
        adAccountName: input.adAccountName ?? details.name,
        facebookPageId: input.facebookPageId,
        facebookPageName: input.facebookPageName,
        instagramAccountId: input.instagramAccountId,
        instagramUsername: input.instagramUsername,
        pixelId: input.pixelId,
        datasetId: input.datasetId,
        currency: details.currency,
        timezone: details.timezone_name,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
      },
      update: {
        businessId: input.businessId,
        businessName: input.businessName,
        adAccountId: input.adAccountId.replace(/^act_/, ""),
        adAccountName: input.adAccountName ?? details.name,
        facebookPageId: input.facebookPageId,
        facebookPageName: input.facebookPageName,
        instagramAccountId: input.instagramAccountId,
        instagramUsername: input.instagramUsername,
        pixelId: input.pixelId,
        datasetId: input.datasetId,
        currency: details.currency,
        timezone: details.timezone_name,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
        disconnectedAt: null,
      },
    });
  },

  async disconnect(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingMetaAdsAccount.findUnique({ where: { brandId } });
    if (!account) throw new AppError("NOT_FOUND", "No Meta Ads account assigned.");
    return prisma.advertisingMetaAdsAccount.update({
      where: { id: account.id },
      data: { status: "DISCONNECTED", disconnectedAt: new Date() },
    });
  },

  async requireAccount(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingMetaAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: true },
    });
    if (!account || account.status !== "CONNECTED") {
      throw new AppError("VALIDATION_ERROR", "Connected Meta Ads account with selected assets is required.");
    }
    if (!account.facebookPageId || !account.adAccountId) {
      throw new AppError("VALIDATION_ERROR", "Ad account and Facebook Page must be selected.");
    }
    return account;
  },
};
