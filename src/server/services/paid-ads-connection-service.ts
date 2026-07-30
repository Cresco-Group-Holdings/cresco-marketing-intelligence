import type { ConnectorType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getPaidAdsAdapter } from "@/lib/connectors/adapters/paid-ads-reporting-adapters";
import { CONNECTOR_TO_PROVIDER, isPaidAdsConnector } from "@/lib/paid-ads/constants";
import type { PaidAdsConnectorMetadata } from "@/lib/paid-ads/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";

function parseMetadata(value: unknown): PaidAdsConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as PaidAdsConnectorMetadata;
}

export const paidAdsConnectionService = {
  async getConnectionStatus(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
  ) {
    if (!isPaidAdsConnector(connectorType)) {
      throw new AppError("VALIDATION_ERROR", "Not a paid ads connector.");
    }

    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType },
      include: { marketingDataSourceAccounts: { where: { brandId }, take: 1 } },
    });

    if (!account) return { connected: false, accountSelected: false, account: null };

    const metadata = parseMetadata(account.metadata);
    return {
      connected: account.status === "CONNECTED",
      accountSelected: Boolean(account.externalAccountId),
      account: {
        id: account.id,
        status: account.status,
        adAccountId: account.externalAccountId,
        adAccountLabel: account.externalAccountLabel,
        grantedScopes: account.grantedScopes,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastErrorMessage: account.lastErrorMessage,
        currency: metadata.currency,
        timezone: metadata.timezone,
        attributionWindow: metadata.attributionWindow,
        metadata,
        warehouseAccountId: account.marketingDataSourceAccounts[0]?.id ?? null,
      },
    };
  },

  async listAdAccounts(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
  ) {
    const account = await this.requireConnectorAccount(brandId, organisationId, connectorType, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Provider account is not connected.");

    const provider = CONNECTOR_TO_PROVIDER[connectorType];
    if (!provider) throw new AppError("VALIDATION_ERROR", "Invalid paid ads connector.");
    const adapter = getPaidAdsAdapter(provider as "GOOGLE_ADS" | "META" | "LINKEDIN" | "TIKTOK");
    return adapter.listAccounts(tokens.accessToken);
  },

  async selectAdAccount(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    input: { accountId: string; accountLabel?: string; currency?: string; timezone?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await this.requireConnectorAccount(brandId, organisationId, connectorType, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Provider account is not connected.");

    const provider = CONNECTOR_TO_PROVIDER[connectorType];
    if (!provider) throw new AppError("VALIDATION_ERROR", "Invalid paid ads connector.");
    const adapter = getPaidAdsAdapter(provider as "GOOGLE_ADS" | "META" | "LINKEDIN" | "TIKTOK");
    const valid = await adapter.validateAccount(tokens.accessToken, input.accountId);
    if (!valid) throw new AppError("FORBIDDEN", "Unable to access the selected ad account.");

    const metadata: PaidAdsConnectorMetadata = {
      adAccountId: input.accountId,
      adAccountName: input.accountLabel ?? input.accountId,
      currency: input.currency,
      timezone: input.timezone,
      syncState: {},
    };

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "CONNECTED",
        externalAccountId: input.accountId,
        externalAccountLabel: input.accountLabel ?? input.accountId,
        displayName: `${connectorType}: ${input.accountLabel ?? input.accountId}`,
        metadata: metadata as Prisma.InputJsonValue,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    const warehouseAccount = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId,
      organisationId,
      projectId: brand.projectId,
      provider,
      externalAccountId: input.accountId,
      displayName: input.accountLabel ?? input.accountId,
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: {
        connectorAccountId: account.id,
        displayName: input.accountLabel ?? input.accountId,
        currency: input.currency,
        timezone: input.timezone,
      },
    });

    return { connectorAccount: updated, warehouseAccountId: warehouseAccount.id };
  },

  async requireConnectorAccount(
    brandId: string,
    organisationId: string,
    connectorType: ConnectorType,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType },
    });
    if (!account) throw new AppError("NOT_FOUND", "Paid ads connector account was not found.");
    return account;
  },
};
