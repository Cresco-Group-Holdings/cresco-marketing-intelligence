import { prisma } from "@/lib/database/prisma";
import type { ProviderCampaignMappingPolicy, Prisma } from "@prisma/client";

export const externalResourceMappingService = {
  async upsertMapping(input: {
    organisationId: string;
    connectionId: string;
    providerKey: string;
    externalResourceType: string;
    externalResourceId: string;
    internalResourceType: string;
    internalResourceId: string;
    mappingPolicy?: ProviderCampaignMappingPolicy;
    sourceUpdatedAt?: Date;
    checksum?: string;
    metadata?: Record<string, unknown>;
  }) {
    const workspaceId = input.organisationId;
    return prisma.externalResourceMapping.upsert({
      where: {
        connectionId_externalResourceType_externalResourceId: {
          connectionId: input.connectionId,
          externalResourceType: input.externalResourceType,
          externalResourceId: input.externalResourceId,
        },
      },
      create: {
        workspaceId,
        organisationId: input.organisationId,
        connectionId: input.connectionId,
        providerKey: input.providerKey,
        externalResourceType: input.externalResourceType,
        externalResourceId: input.externalResourceId,
        internalResourceType: input.internalResourceType,
        internalResourceId: input.internalResourceId,
        mappingPolicy: input.mappingPolicy,
        sourceUpdatedAt: input.sourceUpdatedAt,
        lastSyncedAt: new Date(),
        checksum: input.checksum,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        internalResourceType: input.internalResourceType,
        internalResourceId: input.internalResourceId,
        mappingPolicy: input.mappingPolicy,
        sourceUpdatedAt: input.sourceUpdatedAt,
        lastSyncedAt: new Date(),
        checksum: input.checksum,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  },

  async findByExternal(
    connectionId: string,
    externalResourceType: string,
    externalResourceId: string,
  ) {
    return prisma.externalResourceMapping.findUnique({
      where: {
        connectionId_externalResourceType_externalResourceId: {
          connectionId,
          externalResourceType,
          externalResourceId,
        },
      },
    });
  },

  async listByConnection(organisationId: string, connectionId: string, resourceType?: string) {
    return prisma.externalResourceMapping.findMany({
      where: {
        organisationId,
        connectionId,
        ...(resourceType ? { externalResourceType: resourceType } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async resolveInternalId(
    connectionId: string,
    externalResourceType: string,
    externalResourceId: string,
  ): Promise<string | null> {
    const mapping = await this.findByExternal(connectionId, externalResourceType, externalResourceId);
    return mapping?.internalResourceId ?? null;
  },
};
