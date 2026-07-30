import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_METRIC_DEFINITIONS } from "@/lib/warehouse/metric-registry";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import { getStubNormaliser, supportsStubNormaliser } from "@/lib/warehouse/transformation/stub-adapter";
import { ensureTransformationVersion } from "@/lib/warehouse/transformation-version";
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

async function ensureLineageRecord(
  tx: Prisma.TransactionClient,
  input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    entityType: "DIMENSION" | "METRIC" | "EVENT";
    entityId: string;
    rawMarketingRecordId: string;
    transformationVersionId?: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  const existing = await tx.dataLineageRecord.findFirst({
    where: {
      rawMarketingRecordId: input.rawMarketingRecordId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });
  if (existing) {
    return existing;
  }

  return tx.dataLineageRecord.create({
    data: {
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      entityType: input.entityType,
      entityId: input.entityId,
      parentEntityType: "RAW_RECORD",
      parentEntityId: input.rawMarketingRecordId,
      rawMarketingRecordId: input.rawMarketingRecordId,
      transformationVersionId: input.transformationVersionId,
      metadata: input.metadata,
    },
  });
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
    const transformationVersion = await ensureTransformationVersion();
    const runIdempotencyKey = `normalise:${batch.id}`;

    const existingRun = await prisma.dataTransformationRun.findUnique({
      where: { idempotencyKey: runIdempotencyKey },
    });
    if (existingRun?.status === "COMPLETED") {
      return {
        processed: existingRun.recordsOut,
        failed: existingRun.recordsFailed,
        transformationRunId: existingRun.id,
        resumed: false,
      };
    }

    const records = await prisma.rawMarketingRecord.findMany({
      where: {
        rawMarketingBatchId: batch.id,
        status: { in: ["RECEIVED", "VALIDATED"] },
      },
    });

    const transformationRun =
      existingRun ??
      (await prisma.dataTransformationRun.create({
        data: {
          organisationId: batch.organisationId,
          projectId: batch.projectId,
          brandId: batch.brandId,
          rawMarketingBatchId: batch.id,
          transformationVersionId: transformationVersion.id,
          status: "RUNNING",
          idempotencyKey: runIdempotencyKey,
          recordsIn: records.length,
          startedAt: new Date(),
        },
      }));

    if (existingRun && existingRun.status === "RUNNING") {
      await prisma.dataTransformationRun.update({
        where: { id: existingRun.id },
        data: { status: "RUNNING", recordsIn: records.length },
      });
    }

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

    for (const record of records) {
      try {
        const outcome = await prisma.$transaction(async (tx) => {
          const current = await tx.rawMarketingRecord.findUnique({ where: { id: record.id } });
          if (!current || current.status === "TRANSFORMED") {
            return { status: "skipped" as const };
          }

          const payload = (current.inlinePayload ?? {}) as Record<string, unknown>;
          const result = await normaliser.normalise(
            {
              providerRecordId: current.providerRecordId,
              recordType: current.recordType,
              eventTime: current.eventTime ?? undefined,
              payload,
              metadata: (current.metadata ?? undefined) as Record<string, unknown> | undefined,
            },
            recordContext,
          );

          if (result.status === "REJECTED") {
            await tx.rawMarketingRecord.update({
              where: { id: current.id },
              data: {
                status: "REJECTED",
                metadata: { errors: result.errors } as Prisma.InputJsonValue,
              },
            });
            return { status: "failed" as const };
          }

          for (const dimension of result.dimensions) {
            if (dimension.entityType === "channel") {
              const channel = await tx.marketingChannel.upsert({
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

              await ensureLineageRecord(tx, {
                organisationId: batch.organisationId,
                projectId: batch.projectId,
                brandId: batch.brandId,
                entityType: "DIMENSION",
                entityId: channel.id,
                rawMarketingRecordId: current.id,
                transformationVersionId: transformationVersion.id,
                metadata: { dimensionType: "channel", matchedExisting: true },
              });
            }
          }

          for (const metric of result.metrics) {
            const definition = await tx.marketingMetricDefinition.findFirst({
              where: { brandId: batch.brandId, canonicalKey: metric.metricKey },
            });
            const idempotencyKey = `metric:${current.id}:${metric.metricKey}:${metric.observedAt.toISOString()}`;

            const observation = await tx.marketingMetricObservation.upsert({
              where: { idempotencyKey },
              create: {
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
                idempotencyKey,
              },
              update: {
                metricValue: metric.metricValue,
                dimensions: metric.dimensions as Prisma.InputJsonValue,
              },
            });

            await ensureLineageRecord(tx, {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              entityType: "METRIC",
              entityId: observation.id,
              rawMarketingRecordId: current.id,
              transformationVersionId: transformationVersion.id,
            });
          }

          for (const event of result.events) {
            const idempotencyKey = `event:${current.id}:${event.providerEventId}`;
            const created = await tx.marketingEvent.upsert({
              where: { idempotencyKey },
              create: {
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
                idempotencyKey,
              },
              update: {
                eventName: event.eventName,
                occurredAt: event.occurredAt,
                properties: event.properties as Prisma.InputJsonValue,
              },
            });

            await ensureLineageRecord(tx, {
              organisationId: batch.organisationId,
              projectId: batch.projectId,
              brandId: batch.brandId,
              entityType: "EVENT",
              entityId: created.id,
              rawMarketingRecordId: current.id,
              transformationVersionId: transformationVersion.id,
            });
          }

          await tx.rawMarketingRecord.update({
            where: { id: current.id },
            data: { status: "TRANSFORMED" },
          });

          return { status: "processed" as const };
        });

        if (outcome.status === "processed") {
          processed += 1;
          incrementWarehouseCounter("warehouse.records_normalised");
        } else if (outcome.status === "failed") {
          failed += 1;
          incrementWarehouseCounter("warehouse.records_rejected");
        }
      } catch {
        await prisma.rawMarketingRecord.update({
          where: { id: record.id },
          data: { status: "REJECTED" },
        });
        failed += 1;
        incrementWarehouseCounter("warehouse.records_rejected");
      }
    }

    const runStatus = failed > 0 && processed === 0 ? "FAILED" : "COMPLETED";
    await prisma.dataTransformationRun.update({
      where: { id: transformationRun.id },
      data: {
        status: runStatus,
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
      metadata: { processed, failed, transformationVersion: transformationVersion.version },
    });

    return {
      processed,
      failed,
      transformationRunId: transformationRun.id,
      resumed: Boolean(existingRun),
    };
  },
};
