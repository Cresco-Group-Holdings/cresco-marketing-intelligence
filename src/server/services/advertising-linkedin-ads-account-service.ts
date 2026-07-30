import { prisma } from "@/lib/database/prisma";
import { linkedInAdsAdapter } from "@/lib/advertising-linkedin-ads/adapter";
import { LINKEDIN_ADS_CAPABILITIES, getDisabledCapabilities } from "@/lib/advertising-providers/capability-gates";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingLinkedInAdsAccountService = {
  async getStatus(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const connection = await paidAdsConnectionService.getConnectionStatus(brandId, organisationId, "LINKEDIN", context);
    const assigned = await prisma.advertisingLinkedInAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: { select: { id: true, status: true, externalAccountId: true } } },
    });
    return {
      connection,
      assigned,
      capabilities: LINKEDIN_ADS_CAPABILITIES,
      disabledCapabilities: getDisabledCapabilities(LINKEDIN_ADS_CAPABILITIES),
    };
  },

  async listAssets(brandId: string, organisationId: string, context: TenantContext) {
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "LINKEDIN", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "LinkedIn Ads is not connected.");

    const accounts = await linkedInAdsAdapter.listAccounts(tokens.accessToken);
    const adAccounts = await paidAdsConnectionService.listAdAccounts(brandId, organisationId, "LINKEDIN", context);
    let assets: Awaited<ReturnType<typeof linkedInAdsAdapter.listAssets>> = [];
    if (connectorAccount.externalAccountId) {
      assets = await linkedInAdsAdapter.listAssets(tokens.accessToken, connectorAccount.externalAccountId).catch(() => []);
    }
    return { accounts, adAccounts, assets };
  },

  async assignAccount(
    brandId: string,
    organisationId: string,
    input: { linkedInAccountId: string; linkedInAccountName?: string; organizationUrn?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(brandId, organisationId, "LINKEDIN", context);
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "LinkedIn Ads is not connected.");
    if (!input.linkedInAccountId) throw new AppError("VALIDATION_ERROR", "Ad account must be explicitly selected.");

    const details = await linkedInAdsAdapter.validateAccount(tokens.accessToken, input.linkedInAccountId);

    return prisma.advertisingLinkedInAdsAccount.upsert({
      where: { brandId },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        connectorAccountId: connectorAccount.id,
        linkedInAccountId: input.linkedInAccountId,
        linkedInAccountName: input.linkedInAccountName ?? details.accountName,
        organizationUrn: input.organizationUrn,
        currency: details.currency,
        timezone: details.timezone,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
      },
      update: {
        linkedInAccountId: input.linkedInAccountId,
        linkedInAccountName: input.linkedInAccountName ?? details.accountName,
        organizationUrn: input.organizationUrn,
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
    const account = await prisma.advertisingLinkedInAdsAccount.findUnique({ where: { brandId } });
    if (!account) throw new AppError("NOT_FOUND", "No LinkedIn Ads account assigned.");
    return prisma.advertisingLinkedInAdsAccount.update({
      where: { id: account.id },
      data: { status: "DISCONNECTED", disconnectedAt: new Date() },
    });
  },

  async requireAccount(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingLinkedInAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: true },
    });
    if (!account || account.status !== "CONNECTED") {
      throw new AppError("VALIDATION_ERROR", "Connected LinkedIn Ads account is required.");
    }
    if (!account.linkedInAccountId) {
      throw new AppError("VALIDATION_ERROR", "LinkedIn ad account must be selected.");
    }
    return account;
  },
};
