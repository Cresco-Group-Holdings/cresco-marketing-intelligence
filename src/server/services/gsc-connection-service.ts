import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { gscSearchConsoleAdapter } from "@/lib/connectors/adapters/gsc-search-console-adapter";
import type { GscConnectorMetadata } from "@/lib/gsc/types";
import type { TenantContext } from "@/lib/tenancy/context";
import { connectorCredentialService } from "@/server/services/connector-credential-service";
import { marketingWarehouseRegistryService } from "@/server/services/marketing-warehouse-registry-service";
import { brandService } from "@/server/services/workspace-service";

function parseMetadata(value: unknown): GscConnectorMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as GscConnectorMetadata;
}

export const gscConnectionService = {
  async getConnectionStatus(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType: "GOOGLE_SEARCH_CONSOLE" },
      include: { marketingDataSourceAccounts: { where: { brandId }, take: 1 } },
    });
    if (!account) return { connected: false, siteSelected: false, account: null };

    const metadata = parseMetadata(account.metadata);
    return {
      connected: account.status === "CONNECTED",
      siteSelected: Boolean(account.externalAccountId),
      account: {
        id: account.id,
        status: account.status,
        siteUrl: account.externalAccountId,
        siteLabel: account.externalAccountLabel,
        grantedScopes: account.grantedScopes,
        connectedAt: account.connectedAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: account.lastSuccessfulSyncAt?.toISOString() ?? null,
        lastErrorMessage: account.lastErrorMessage,
        metadata,
        warehouseAccountId: account.marketingDataSourceAccounts[0]?.id ?? null,
      },
    };
  },

  async listSites(brandId: string, organisationId: string, context: TenantContext) {
    const account = await this.requireConnectorAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google account is not connected.");
    return gscSearchConsoleAdapter.listSites(tokens.accessToken);
  },

  async selectSite(
    brandId: string,
    organisationId: string,
    input: { siteUrl: string; siteLabel?: string },
    context: TenantContext,
  ) {
    const brand = await brandService.getById(brandId, organisationId, context);
    const account = await this.requireConnectorAccount(brandId, organisationId, context);
    const tokens = await connectorCredentialService.readTokens(account.id);
    if (!tokens?.accessToken) throw new AppError("VALIDATION_ERROR", "Google account is not connected.");

    const valid = await gscSearchConsoleAdapter.validateSite(tokens.accessToken, input.siteUrl);
    if (!valid) throw new AppError("FORBIDDEN", "Unable to access the selected Search Console property.");

    const siteType = input.siteUrl.startsWith("sc-domain:") ? "domain" : "url_prefix";
    const metadata: GscConnectorMetadata = {
      siteUrl: input.siteUrl,
      siteType,
      syncState: {},
    };

    const updated = await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        status: "CONNECTED",
        externalAccountId: input.siteUrl,
        externalAccountLabel: input.siteLabel ?? input.siteUrl,
        displayName: `GSC: ${input.siteLabel ?? input.siteUrl}`,
        metadata: metadata as Prisma.InputJsonValue,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    const warehouseAccount = await marketingWarehouseRegistryService.ensureSourceAccount({
      brandId,
      organisationId,
      projectId: brand.projectId,
      provider: "GOOGLE_SEARCH_CONSOLE",
      externalAccountId: input.siteUrl,
      displayName: input.siteLabel ?? input.siteUrl,
    });

    await prisma.marketingDataSourceAccount.update({
      where: { id: warehouseAccount.id },
      data: { connectorAccountId: account.id, displayName: input.siteLabel ?? input.siteUrl },
    });

    return { connectorAccount: updated, warehouseAccountId: warehouseAccount.id };
  },

  async requireConnectorAccount(brandId: string, organisationId: string, context: TenantContext) {
    await brandService.getById(brandId, organisationId, context);
    const account = await prisma.connectorAccount.findFirst({
      where: { brandId, organisationId, connectorType: "GOOGLE_SEARCH_CONSOLE" },
    });
    if (!account) throw new AppError("NOT_FOUND", "Search Console connector account was not found.");
    return account;
  },
};
