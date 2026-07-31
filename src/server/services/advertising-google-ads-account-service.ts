import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { googleAdsMutateClient } from "@/lib/google-ads/mutate-client";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { paidAdsConnectionService } from "@/server/services/paid-ads-connection-service";
import { brandService } from "@/server/services/workspace-service";

export const advertisingGoogleAdsAccountService = {
  async getStatus(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const connection = await paidAdsConnectionService.getConnectionStatus(brandId, organisationId, "GOOGLE_ADS", context);
    const assigned = await prisma.advertisingGoogleAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: { select: { id: true, status: true, externalAccountId: true } } },
    });
    return { connection, assigned };
  },

  async assignAccount(
    brandId: string,
    organisationId: string,
    input: { customerId: string; managerCustomerId?: string; customerName?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const connectorAccount = await paidAdsConnectionService.requireConnectorAccount(
      brandId,
      organisationId,
      "GOOGLE_ADS",
      context,
    );
    const tokens = await connectorCredentialService.readTokens(connectorAccount.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google Ads is not connected.");

    const details = await googleAdsMutateClient.getCustomerDetails(
      tokens.accessToken,
      input.customerId,
      input.managerCustomerId,
    );

    if (details.manager) {
      throw new AppError("VALIDATION_ERROR", "Select a client customer account, not a manager account.");
    }

    return prisma.advertisingGoogleAdsAccount.upsert({
      where: { brandId },
      create: {
        organisationId,
        projectId: brand.projectId,
        brandId,
        connectorAccountId: connectorAccount.id,
        managerCustomerId: input.managerCustomerId?.replace(/-/g, ""),
        customerId: input.customerId.replace(/-/g, ""),
        customerName: input.customerName ?? details.descriptiveName,
        currency: details.currencyCode,
        timezone: details.timeZone,
        accessLevel: "STANDARD",
        isTestAccount: details.testAccount ?? false,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
      },
      update: {
        managerCustomerId: input.managerCustomerId?.replace(/-/g, ""),
        customerId: input.customerId.replace(/-/g, ""),
        customerName: input.customerName ?? details.descriptiveName,
        currency: details.currencyCode,
        timezone: details.timeZone,
        isTestAccount: details.testAccount ?? false,
        status: "CONNECTED",
        assignedAt: new Date(),
        assignedByUserId: context.userProfileId,
        disconnectedAt: null,
      },
    });
  },

  async disconnect(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingGoogleAdsAccount.findUnique({ where: { brandId } });
    if (!account) throw new AppError("NOT_FOUND", "No Google Ads account assigned to this brand.");
    return prisma.advertisingGoogleAdsAccount.update({
      where: { id: account.id },
      data: { status: "DISCONNECTED", disconnectedAt: new Date() },
    });
  },

  async requireAccount(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.advertisingGoogleAdsAccount.findUnique({
      where: { brandId },
      include: { connectorAccount: true },
    });
    if (!account || account.status !== "CONNECTED") {
      throw new AppError("VALIDATION_ERROR", "A connected Google Ads account must be assigned to this brand.");
    }
    return account;
  },

  async listAccessibleAccounts(brandId: string, organisationId: string, context: TenantContext) {
    return paidAdsConnectionService.listAdAccounts(brandId, organisationId, "GOOGLE_ADS", context);
  },
};
