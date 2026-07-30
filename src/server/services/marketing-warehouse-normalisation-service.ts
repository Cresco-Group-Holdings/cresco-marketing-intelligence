import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_METRIC_DEFINITIONS } from "@/lib/warehouse/metric-registry";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import { getStubNormaliser, supportsStubNormaliser } from "@/lib/warehouse/transformation/stub-adapter";
import type { TenantContext } from "@/lib/tenancy/context";
import { recordAuditEvent } from "@/server/services/audit-service";

async function ensureMetricDefinitions(
  brandId: string,
  organisationId: string,
  projectId: string,
) {
  for (const definition of DEFAULT_METRIC_DEFINITIONS) {
    await prisma.marketingMetricDefinition.upsert({
      where: {
        brandId_canonicalKey: { brandId, canonicalKey: definition.canonicalKey },
      },
      create: {
        organisationId,
        projectId,
        brandId,
        canonicalKey: definition.canonicalKey,
        displayName: definition.displayName,
        description: definition.description,
        unit: definition.unit,
        dataType: definition.dataType,
        aggregation: definition.aggregation,
        isCumulative: definition.isCumulative,
      },
      update: {
        displayName: definition.displayName,
        description: definition.description,
        unit: definition.unit,
        isActive: true,
      },
    });
  }
}

export const marketingWarehouseNormalisationService = {
  async normaliseBatch(batchId: string, context: TenantContext, requestId?: string) {
    const batch = await prisma.rawMarketingBatch.findFirst({
      where: { id: batchId, organisationId: context.organisationId },
      include: {
        marketingDataSourceAccount: { include: { marketingDataSource: true } },
      },
    });
    if (!batch) {
      throw new AppError("NOT_FOUND", "Batch was not found.");
    }

    if (!supportsStubNormaliser(batch.provider)) {
      throw new AppError(
        "INTERNAL_ERROR",
        `Normalisation adapter not available for provider ${batch.provider}.`,
      );
    }

    await ensureMetricDefinitions(batch.brandId, batch.organisationId, batch.projectId);

    const records = await prisma.rawMarketingRecord.findMany({
      where: {
        rawMarketingBatchId: batch.id,
        status: { in: ["RECEIVED", "VALIDATED"] },
      },
    });

    const normaliser = getStubNormaliser(batch.provider);
    const recordContext = {
      organisationId: batch.organisationId,
      projectId: batch.projectId,
      brandId: batch.brandId,
      marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
      provider: batch.provider,
      batchId: batch.id,
    };

    let processed = 0;
    let failed = 0;

    const transformationRun = await prisma.dataTransformationRun.create({
      data: {
        organisationId: batch.organisationId,
        projectId: batch.projectId,
        brandId: batch.brandId,
        rawMarketingBatchId: batch.id,
        status: "RUNNING",
        idempotencyKey: `normalise:${batch.id}:${randomUUID()}`,
        recordsIn: records.length,
        startedAt: new Date(),
      },
    });

    for (const record of records) {
      const payload = (record.inlinePayload ?? {}) as Record<string, unknown>;
      try {
        const result = await normaliser.normalise(
          {
            providerRecordId: record.providerRecordId,
            recordType: record.recordType,
            eventTime: record.eventTime ?? undefined,
            payload,
            metadata: (record.metadata ?? undefined) as Record<string, unknown> | undefined,
          },
          recordContext,
        );

        if (result.status === "REJECTED") {
          await prisma.rawMarketingRecord.update({
            where: { id: record.id },
            data: { status: "REJECTED", metadata: { errors: result.errors } as Prisma.InputJsonValue },
          });
          failed += 1;
          incrementWarehouseCounter("warehouse.records_rejected");
          continue;
        }

        for (const dimension of result.dimensions) {
          if (dimension.entityType === "channel") {
            const channel = await prisma.marketingChannel.upsert({
              where: {
                brandId_provider_providerChannelId: {
                  brandId: batch.brandId,
                  provider: batch.provider,
                  providerChannelId: dimension.providerId,
                },
              },
              create: {
                organisationId: batch.organisationId,
                projectId: batch.projectId,
                brandId: batch.brandId,
                marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                provider: batch.provider,
                providerChannelId: dimension.providerId,
                name: dimension.name,
                providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                firstSeenAt: new Date(),
                lastSeenAt: new Date(),
              },
              update: {
                name: dimension.name,
                lastSeenAt: new Date(),
              },
            });

            await prisma.dataLineageRecord.create({
              data: {
                organisationId: batch.organisationId,
                projectId: batch.projectId,
                brandId: batch.brandId,
                entityType: "DIMENSION",
                entityId: channel.id,
                parentEntityType: "RAW_RECORD",
                parentEntityId: record.id,
                rawMarketingRecordId: record.id,
                metadata: { dimensionType: "channel" },
              },
            });
          }
        }

        for (const metric of result.metrics) {
          const definition = await prisma.marketingMetricDefinition.findFirst({
            where: { brandId: batch.brandId, canonicalKey: metric.metricKey },
          });

          const observation = await prisma.marketingMetricObservation.create({
            data: {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
              marketingMetricDefinitionId: definition?.id,
              provider: batch.provider,
              source: batch.provider === "MANUAL_IMPORT" ? "MANUAL_IMPORT" : "FIRST_PARTY",
              metricKey: metric.metricKey,
              metricValue: metric.metricValue,
              observedAt: metric.observedAt,
              dimensions: metric.dimensions as Prisma.InputJsonValue,
              idempotencyKey: `metric:${record.id}:${metric.metricKey}:${metric.observedAt.toISOString()}`,
            },
          });

          await prisma.dataLineageRecord.create({
            data: {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              entityType: "METRIC",
              entityId: observation.id,
              parentEntityType: "RAW_RECORD",
              parentEntityId: record.id,
              rawMarketingRecordId: record.id,
            },
          });
        }

        for (const event of result.events) {
          const created = await prisma.marketingEvent.create({
            data: {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
              provider: batch.provider,
              source: batch.provider === "MANUAL_IMPORT" ? "MANUAL_IMPORT" : "FIRST_PARTY",
              providerEventId: event.providerEventId,
              eventName: event.eventName,
              occurredAt: event.occurredAt,
              properties: event.properties as Prisma.InputJsonValue,
              idempotencyKey: `event:${record.id}:${event.providerEventId}`,
            },
          });

          await prisma.dataLineageRecord.create({
            data: {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              entityType: "EVENT",
              entityId: created.id,
              parentEntityType: "RAW_RECORD",
              parentEntityId: record.id,
              rawMarketingRecordId: record.id,
            },
          });
        }

        await prisma.rawMarketingRecord.update({
          where: { id: record.id },
          data: { status: "TRANSFORMED" },
        });
        processed += 1;
        incrementWarehouseCounter("warehouse.records_normalised");
      } catch {
        await prisma.rawMarketingRecord.update({
          where: { id: record.id },
          data: { status: "REJECTED" },
        });
        failed += 1;
        incrementWarehouseCounter("warehouse.records_rejected");
      }
    }

    await prisma.dataTransformationRun.update({
      where: { id: transformationRun.id },
      data: {
        status: failed > 0 && processed === 0 ? "FAILED" : "COMPLETED",
        recordsOut: processed,
        recordsFailed: failed,
        completedAt: new Date(),
      },
    });

    await prisma.rawMarketingBatch.update({
      where: { id: batch.id },
      data: {
        recordsProcessed: processed,
        recordsFailed: failed,
        status: failed > 0 && processed === 0 ? "FAILED" : failed > 0 ? "PARTIAL" : "COMPLETED",
        completedAt: new Date(),
      },
    });

    await recordAuditEvent({
      organisationId: batch.organisationId,
      projectId: batch.projectId,
      actorUserId: context.userProfileId,
      action: "warehouse.batch.normalised",
      resourceType: "RawMarketingBatch",
      resourceId: batch.id,
      requestId,
      metadata: { processed, failed },
    });

    return { processed, failed, transformationRunId: transformationRun.id };
  },
};
