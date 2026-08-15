import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { buildFactFingerprint } from "@/lib/analytics-core/deduplication";
import { mapProviderMetrics } from "@/lib/integrations/sync/metric-mapping";
import { validateMetricRecord } from "@/lib/integrations/sync/data-quality";
import type { CanonicalMetricRecord } from "@/lib/integrations/sync/types";
import { externalResourceMappingService } from "@/server/services/external-resource-mapping-service";

export const analyticsSyncBridgeService = {
  async getOrCreateConnectorDataSource(organisationId: string, providerKey: string, connectionId: string) {
    const workspaceId = organisationId;
    const name = `Provider sync: ${providerKey}`;
    const existing = await prisma.analyticsDataSource.findFirst({
      where: {
        organisationId,
        kind: "CONNECTOR",
        providerKey,
        metadata: { path: ["connectionId"], equals: connectionId },
      },
    });
    if (existing) return existing;

    return prisma.analyticsDataSource.create({
      data: {
        organisationId,
        workspaceId,
        name,
        kind: "CONNECTOR",
        status: "ACTIVE",
        providerKey,
        metadata: { connectionId },
      },
    });
  },

  async ingestMetricRecords(input: {
    organisationId: string;
    connectionId: string;
    providerKey: string;
    syncRunId: string;
    records: CanonicalMetricRecord[];
    projectId?: string | null;
    brandId?: string | null;
  }) {
    const dataSource = await this.getOrCreateConnectorDataSource(
      input.organisationId,
      input.providerKey,
      input.connectionId,
    );

    const batch = await prisma.analyticsImportBatch.create({
      data: {
        organisationId: input.organisationId,
        workspaceId: input.organisationId,
        dataSourceId: dataSource.id,
        status: "VALIDATING",
        fileName: `sync:${input.syncRunId}`,
        rowCount: input.records.length,
        createdByUserId: null,
      },
    });

    let accepted = 0;
    let rejected = 0;
    const warnings: string[] = [];

    for (const record of input.records) {
      const qualityWarnings = validateMetricRecord(record);
      warnings.push(...qualityWarnings.map((w) => w.message));

      const { mapped, unsupported } = mapProviderMetrics(record.metrics);
      if (unsupported.length > 0) {
        warnings.push(`Unsupported provider metrics: ${unsupported.join(", ")}`);
      }

      let campaignId: string | null = null;
      if (record.externalCampaignId) {
        campaignId = await externalResourceMappingService.resolveInternalId(
          input.connectionId,
          "campaign",
          record.externalCampaignId,
        );
      }

      for (const [metricKey, value] of Object.entries(mapped)) {
        const occurredAt = new Date(record.occurredAt);
        const fingerprint = buildFactFingerprint({
          organisationId: input.organisationId,
          projectId: input.projectId,
          brandId: input.brandId,
          campaignId,
          channel: input.providerKey,
          provider: input.providerKey,
          metricKey,
          occurredAt,
          granularity: record.granularity,
          currency: record.currency,
          dimensions: record.dimensions ?? {},
        });

        try {
          await prisma.analyticsFact.create({
            data: {
              organisationId: input.organisationId,
              workspaceId: input.organisationId,
              projectId: input.projectId,
              brandId: input.brandId,
              campaignId,
              channel: input.providerKey,
              provider: input.providerKey,
              dataSourceId: dataSource.id,
              metricKey,
              value: new Prisma.Decimal(value),
              currency: record.currency,
              occurredAt,
              granularity: record.granularity === "HOUR" ? "HOUR" : record.granularity === "TOTAL" ? "TOTAL" : "DAY",
              dimensions: (record.dimensions ?? {}) as Prisma.InputJsonObject,
              sourceBatchId: batch.id,
              dedupeFingerprint: fingerprint,
            },
          });
          accepted += 1;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            // duplicate fingerprint — safe re-sync
            continue;
          }
          rejected += 1;
        }
      }
    }

    await prisma.analyticsImportBatch.update({
      where: { id: batch.id },
      data: {
        status: rejected > 0 ? "PARTIAL" : "COMPLETED",
        acceptedCount: accepted,
        rejectedCount: rejected,
        completedAt: new Date(),
      },
    });

    return { accepted, rejected, warnings, batchId: batch.id };
  },
};
