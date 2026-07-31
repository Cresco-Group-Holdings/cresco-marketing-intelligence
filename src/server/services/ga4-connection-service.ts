import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { ga4AnalyticsAdapter } from "@/lib/connectors/adapters/ga4-analytics-adapter";
import type { Ga4ConnectorMetadata } from "@/lib/ga4/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";

function parseMetadata(value: unknown): Ga4ConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Ga4ConnectorMetadata;
}

export const ga4ConnectionService = {
  async getConnectionStatus(
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType: "GOOGLE_ANALYTICS_4" },
      include: {
        marketingDataSourceAccounts: {
          where: { brandId },
          take: 1,
        },
      },
    });

    if (!account) {
      return { connected: false, propertySelected: false, account: null };
    }

    const metadata = parseMetadata(account.metadata);
    const warehouseAccount = account.marketingDataSourceAccounts[0] ?? null;

    return {
      connected: account.status === "CONNECTED",
      propertySelected: Boolean(account.externalAccountId),
      account: {
        id: account.id,
        status: account.status,
        displayName: account.displayName,
        externalAccountId: account.externalAccountId,
        externalAccountLabel: account.externalAccountLabel,
        grantedScopes: account.grantedScopes,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastErrorMessage: account.lastErrorMessage,
        metadata,
        warehouseAccountId: warehouseAccount?.id ?? null,
        timezone: metadata.timeZone ?? warehouseAccount?.timezone ?? null,
        currency: metadata.currencyCode ?? warehouseAccount?.currency ?? null,
      },
    };
  },

  async listAccounts(brandId: string, organisationId: string, context: TenantContext) {
    const account = await this.requireConnectorAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) {
      throw new AppError("VALIDATION_ERROR", "Google account is not connected.");
    }
    return ga4AnalyticsAdapter.listAccounts(tokens.accessToken);
  },

  async listProperties(
    brandId: string,
    organisationId: string,
    accountName: string,
    context: TenantContext,
  ) {
    const account = await this.requireConnectorAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) {
      throw new AppError("VALIDATION_ERROR", "Google account is not connected.");
    }
    return ga4AnalyticsAdapter.listProperties(tokens.accessToken, accountName);
  },

  async selectProperty(
    brandId: string,
    organisationId: string,
    input: {
      accountName: string;
      propertyName: string;
      propertyDisplayName: string;
    },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await this.requireConnectorAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) {
      throw new AppError("VALIDATION_ERROR", "Google account is not connected.");
    }

    const propertyId = input.propertyName.replace("properties/", "");
    const metadata = await ga4AnalyticsAdapter.readPropertyMetadata(tokens.accessToken, propertyId);
    const valid = await ga4AnalyticsAdapter.validateConnection(tokens.accessToken, propertyId);
    if (!valid) {
      throw new AppError("VALIDATION_ERROR", "Unable to access the selected GA4 property.");
    }

    const connectorMetadata: Ga4ConnectorMetadata = {
      ga4AccountName: input.accountName,
      ga4PropertyName: input.propertyName,
      ga4PropertyDisplayName: input.propertyDisplayName,
      timeZone: metadata.timeZone,
      currencyCode: metadata.currencyCode,
      syncState: {},
    };

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "CONNECTED",
        externalAccountId: propertyId,
        externalAccountLabel: input.propertyDisplayName,
        displayName: `GA4: ${input.propertyDisplayName}`,
        metadata: connectorMetadata as Prisma.InputJsonValue,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    const warehouseAccount = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId,
      organisationId,
      projectId: brand.projectId,
      provider: "GA4",
      externalAccountId: propertyId,
      displayName: input.propertyDisplayName,
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: {
        connectorAccountId: account.id,
        timezone: metadata.timeZone,
        currency: metadata.currencyCode,
        displayName: input.propertyDisplayName,
      },
    });

    return {
      connectorAccount: updated,
      warehouseAccountId: warehouseAccount.id,
      property: metadata,
    };
  },

  async requireConnectorAccount(
    brandId: string,
    organisationId: string,
    context: TenantContext,
  ) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType: "GOOGLE_ANALYTICS_4" },
    });
    if (!account) {
      throw new AppError("NOT_FOUND", "GA4 connector account was not found.");
    }
    return account;
  },
};
