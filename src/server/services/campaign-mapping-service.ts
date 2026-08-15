import { randomUUID } from "node:crypto";
import type { ProviderCampaignMappingPolicy } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import type { TenantContext } from "@/lib/tenancy/context";
import type { CanonicalCampaignRecord } from "@/lib/integrations/sync/types";
import { externalResourceMappingService } from "@/server/services/external-resource-mapping-service";

export const campaignMappingService = {
  async listCampaignMappings(context: TenantContext, connectionId: string) {
    const mappings = await externalResourceMappingService.listByConnection(
      context.organisationId,
      connectionId,
      "campaign",
    );
    return mappings.map((mapping) => ({
      id: mapping.id,
      externalResourceId: mapping.externalResourceId,
      internalResourceId: mapping.internalResourceId,
      mappingPolicy: mapping.mappingPolicy,
      lastSyncedAt: mapping.lastSyncedAt.toISOString(),
      metadata: mapping.metadata,
    }));
  },

  async reviewImportedCampaigns(
    context: TenantContext,
    connectionId: string,
    records: CanonicalCampaignRecord[],
  ) {
    return records.map((record) => ({
      externalResourceId: record.externalId,
      externalName: record.name,
      mappingPolicy: "EXTERNAL_ONLY" as ProviderCampaignMappingPolicy,
      requiresReview: true,
    }));
  },

  async applyCampaignMapping(
    context: TenantContext,
    connectionId: string,
    input: {
      externalResourceId: string;
      mappingPolicy: ProviderCampaignMappingPolicy;
      internalCampaignId?: string;
      externalName?: string;
    },
  ) {
    const connection = await prisma.providerConnection.findFirst({
      where: { id: connectionId, organisationId: context.organisationId },
    });
    if (!connection) throw new AppError("NOT_FOUND", "Provider connection not found.");

    if (input.mappingPolicy === "IGNORED" || input.mappingPolicy === "ARCHIVED_EXTERNALLY") {
      return externalResourceMappingService.upsertMapping({
        organisationId: context.organisationId,
        connectionId,
        providerKey: connection.providerKey,
        externalResourceType: "campaign",
        externalResourceId: input.externalResourceId,
        internalResourceType: "ignored",
        internalResourceId: input.externalResourceId,
        mappingPolicy: input.mappingPolicy,
        metadata: { externalName: input.externalName },
      });
    }

    if (input.mappingPolicy === "IMPORTED_AS_INTERNAL") {
      if (!connection.projectId || !connection.brandId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Connection must have project and brand scope to import campaigns.",
        );
      }
      const campaign = await prisma.campaign.create({
        data: {
          organisationId: context.organisationId,
          projectId: connection.projectId,
          brandId: connection.brandId,
          name: input.externalName ?? `Imported ${input.externalResourceId}`,
          status: "DRAFT",
          ownerUserId: context.userProfileId,
          createdByUserId: context.userProfileId,
        },
      });

      return externalResourceMappingService.upsertMapping({
        organisationId: context.organisationId,
        connectionId,
        providerKey: connection.providerKey,
        externalResourceType: "campaign",
        externalResourceId: input.externalResourceId,
        internalResourceType: "campaign",
        internalResourceId: campaign.id,
        mappingPolicy: input.mappingPolicy,
        metadata: { externalName: input.externalName },
      });
    }

    if (input.mappingPolicy === "LINKED_TO_INTERNAL") {
      if (!input.internalCampaignId) {
        throw new AppError("VALIDATION_ERROR", "internalCampaignId is required for LINKED_TO_INTERNAL.");
      }
      const campaign = await prisma.campaign.findFirst({
        where: { id: input.internalCampaignId, organisationId: context.organisationId },
      });
      if (!campaign) throw new AppError("NOT_FOUND", "Internal campaign not found.");

      return externalResourceMappingService.upsertMapping({
        organisationId: context.organisationId,
        connectionId,
        providerKey: connection.providerKey,
        externalResourceType: "campaign",
        externalResourceId: input.externalResourceId,
        internalResourceType: "campaign",
        internalResourceId: campaign.id,
        mappingPolicy: input.mappingPolicy,
        metadata: { externalName: input.externalName },
      });
    }

    return externalResourceMappingService.upsertMapping({
      organisationId: context.organisationId,
      connectionId,
      providerKey: connection.providerKey,
      externalResourceType: "campaign",
      externalResourceId: input.externalResourceId,
      internalResourceType: "external_campaign",
      internalResourceId: input.externalResourceId,
      mappingPolicy: "EXTERNAL_ONLY",
      metadata: { externalName: input.externalName },
    });
  },

  async importCampaignRecord(
    context: TenantContext,
    connectionId: string,
    record: CanonicalCampaignRecord,
    defaultPolicy: ProviderCampaignMappingPolicy = "EXTERNAL_ONLY",
  ) {
    const existing = await externalResourceMappingService.findByExternal(
      connectionId,
      "campaign",
      record.externalId,
    );
    if (existing) {
      await externalResourceMappingService.upsertMapping({
        organisationId: context.organisationId,
        connectionId,
        providerKey: (await prisma.providerConnection.findUnique({ where: { id: connectionId } }))!
          .providerKey,
        externalResourceType: "campaign",
        externalResourceId: record.externalId,
        internalResourceType: existing.internalResourceType,
        internalResourceId: existing.internalResourceId,
        mappingPolicy: existing.mappingPolicy ?? defaultPolicy,
        sourceUpdatedAt: record.sourceUpdatedAt ? new Date(record.sourceUpdatedAt) : undefined,
        checksum: record.checksum,
        metadata: { name: record.name, status: record.status },
      });
      return existing;
    }

    if (defaultPolicy === "IMPORTED_AS_INTERNAL") {
      return this.applyCampaignMapping(context, connectionId, {
        externalResourceId: record.externalId,
        mappingPolicy: "IMPORTED_AS_INTERNAL",
        externalName: record.name,
      });
    }

    return this.applyCampaignMapping(context, connectionId, {
      externalResourceId: record.externalId,
      mappingPolicy: defaultPolicy,
      externalName: record.name,
    });
  },

  generateExternalCampaignId(): string {
    return `ext_${randomUUID()}`;
  },
};
