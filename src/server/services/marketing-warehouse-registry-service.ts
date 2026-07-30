import type { MarketingDataProvider } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { DEFAULT_SOURCE_DEFINITIONS } from "@/lib/warehouse/constants";
import type { TenantContext } from "@/lib/tenancy/context";
import { brandService } from "@/server/services/workspace-service";

export const marketingWarehouseRegistryService = {
  async ensureDefaultSources() {
    for (const source of DEFAULT_SOURCE_DEFINITIONS) {
      const created = await prisma.marketingDataSource.upsert({
        where: { key: source.key },
        create: {
          provider: source.provider,
          key: source.key,
          displayName: source.displayName,
          description: source.description,
          category: source.category,
          isConnected: false,
          capabilities: {
            create: source.capabilities.map((capabilityType) => ({
              capabilityType,
              enabled: true,
            })),
          },
        },
        update: {
          displayName: source.displayName,
          description: source.description,
          category: source.category,
        },
      });

      for (const capabilityType of source.capabilities) {
        await prisma.marketingDataSourceCapability.upsert({
          where: {
            marketingDataSourceId_capabilityType: {
              marketingDataSourceId: created.id,
              capabilityType,
            },
          },
          create: {
            marketingDataSourceId: created.id,
            capabilityType,
            enabled: true,
          },
          update: { enabled: true },
        });
      }
    }
  },

  async listSources() {
    await this.ensureDefaultSources();
    return prisma.marketingDataSource.findMany({
      where: { status: "ACTIVE" },
      include: {
        capabilities: { where: { enabled: true } },
        _count: { select: { accounts: true } },
      },
      orderBy: [{ category: "asc" }, { displayName: "asc" }],
    });
  },

  async listAccounts(brandId: string, organisationId: string, context: TenantContext) {
    await this.ensureDefaultSources();
    await brandService.getById(brandId, organisationId, context);

    return prisma.marketingDataSourceAccount.findMany({
      where: { organisationId, brandId },
      include: {
        marketingDataSource: {
          include: { capabilities: { where: { enabled: true } } },
        },
        healthRecords: { orderBy: { lastCheckedAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  async ensureSourceAccount(input: {
    brandId: string;
    organisationId: string;
    projectId: string;
    provider: MarketingDataProvider;
    externalAccountId?: string;
    displayName?: string;
  }) {
    await this.ensureDefaultSources();
    const source = await prisma.marketingDataSource.findFirst({
      where: { provider: input.provider },
    });
    if (!source) {
      throw new Error(`No marketing data source registered for provider ${input.provider}`);
    }

    const externalAccountId = input.externalAccountId ?? "default";
    return prisma.marketingDataSourceAccount.upsert({
      where: {
        brandId_marketingDataSourceId_externalAccountId: {
          brandId: input.brandId,
          marketingDataSourceId: source.id,
          externalAccountId,
        },
      },
      create: {
        organisationId: input.organisationId,
        projectId: input.projectId,
        brandId: input.brandId,
        marketingDataSourceId: source.id,
        externalAccountId,
        displayName: input.displayName ?? source.displayName,
      },
      update: {
        displayName: input.displayName ?? undefined,
      },
      include: { marketingDataSource: true },
    });
  },
};
