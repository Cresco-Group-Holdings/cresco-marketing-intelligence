import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DEFAULT_METRIC_DEFINITIONS } from "@/lib/warehouse/metric-registry";
import { incrementWarehouseCounter } from "@/lib/warehouse/observability";
import { getWarehouseNormaliser, metricSourceForProvider, supportsWarehouseNormaliser } from "@/lib/warehouse/transformation/registry";
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

    if (!supportsWarehouseNormaliser(batch.provider)) {
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

    const normaliser = getWarehouseNormaliser(batch.provider);
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

          const dimensionIds: {
            searchQuery?: string;
            landingPage?: string;
            geography?: string;
            device?: string;
            channel?: string;
            account?: string;
            campaign?: string;
            adGroup?: string;
            ad?: string;
            creative?: string;
          } = {};

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
              dimensionIds.channel = channel.id;

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

            if (dimension.entityType === "search_query") {
              const query = await tx.marketingSearchQuery.upsert({
                where: {
                  brandId_provider_providerQueryId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerQueryId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  provider: batch.provider,
                  providerQueryId: dimension.providerId,
                  queryText: dimension.name,
                  isAnonymized: Boolean(dimension.metadata?.isAnonymized),
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { queryText: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.searchQuery = query.id;
            }

            if (dimension.entityType === "landing_page") {
              const page = await tx.marketingLandingPage.upsert({
                where: {
                  brandId_provider_providerPageId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerPageId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  provider: batch.provider,
                  providerPageId: dimension.providerId,
                  url: dimension.name,
                  path: typeof dimension.metadata?.path === "string" ? dimension.metadata.path : undefined,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { url: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.landingPage = page.id;
            }

            if (dimension.entityType === "geography") {
              const geography = await tx.marketingGeography.upsert({
                where: {
                  brandId_provider_providerGeographyId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerGeographyId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  provider: batch.provider,
                  providerGeographyId: dimension.providerId,
                  countryCode: dimension.name,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { lastSeenAt: new Date() },
              });
              dimensionIds.geography = geography.id;
            }

            if (dimension.entityType === "device") {
              const device = await tx.marketingDevice.upsert({
                where: {
                  brandId_provider_providerDeviceId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerDeviceId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  provider: batch.provider,
                  providerDeviceId: dimension.providerId,
                  deviceCategory: dimension.name,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { lastSeenAt: new Date() },
              });
              dimensionIds.device = device.id;
            }

            if (dimension.entityType === "account") {
              const account = await tx.marketingAccount.upsert({
                where: {
                  brandId_provider_providerAccountId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerAccountId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  provider: batch.provider,
                  providerAccountId: dimension.providerId,
                  name: dimension.name,
                  currency: typeof dimension.metadata?.currency === "string" ? dimension.metadata.currency : undefined,
                  timezone: typeof dimension.metadata?.timezone === "string" ? dimension.metadata.timezone : undefined,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { name: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.account = account.id;
            }

            if (dimension.entityType === "campaign") {
              const campaign = await tx.marketingCampaign.upsert({
                where: {
                  brandId_provider_providerCampaignId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerCampaignId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  marketingAccountId: dimensionIds.account,
                  marketingChannelId: dimensionIds.channel,
                  provider: batch.provider,
                  providerCampaignId: dimension.providerId,
                  name: dimension.name,
                  campaignType: typeof dimension.metadata?.campaignType === "string" ? dimension.metadata.campaignType : undefined,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { name: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.campaign = campaign.id;
            }

            if (dimension.entityType === "ad_group") {
              const adGroup = await tx.marketingAdGroup.upsert({
                where: {
                  brandId_provider_providerAdGroupId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerAdGroupId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  marketingCampaignId: dimensionIds.campaign,
                  provider: batch.provider,
                  providerAdGroupId: dimension.providerId,
                  name: dimension.name,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { name: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.adGroup = adGroup.id;
            }

            if (dimension.entityType === "ad") {
              const ad = await tx.marketingAd.upsert({
                where: {
                  brandId_provider_providerAdId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerAdId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  marketingAdGroupId: dimensionIds.adGroup,
                  provider: batch.provider,
                  providerAdId: dimension.providerId,
                  name: dimension.name,
                  adType: typeof dimension.metadata?.adType === "string" ? dimension.metadata.adType : undefined,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { name: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.ad = ad.id;
            }

            if (dimension.entityType === "creative") {
              const creative = await tx.marketingCreative.upsert({
                where: {
                  brandId_provider_providerCreativeId: {
                    brandId: batch.brandId,
                    provider: batch.provider,
                    providerCreativeId: dimension.providerId,
                  },
                },
                create: {
                  organisationId: batch.organisationId,
                  projectId: batch.projectId,
                  brandId: batch.brandId,
                  marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                  marketingAdId: dimensionIds.ad,
                  provider: batch.provider,
                  providerCreativeId: dimension.providerId,
                  name: dimension.name,
                  creativeType: typeof dimension.metadata?.creativeType === "string" ? dimension.metadata.creativeType : undefined,
                  providerMetadata: dimension.metadata as Prisma.InputJsonValue,
                  firstSeenAt: new Date(),
                  lastSeenAt: new Date(),
                },
                update: { name: dimension.name, lastSeenAt: new Date() },
              });
              dimensionIds.creative = creative.id;
            }
          }

          const metricSource = metricSourceForProvider(batch.provider);

          for (const metric of result.metrics) {
            const definition = await tx.marketingMetricDefinition.findFirst({
              where: { brandId: batch.brandId, canonicalKey: metric.metricKey },
            });
            const grainSuffix = metric.grain ? `:${metric.grain}` : "";
            const idempotencyKey = `metric:${current.id}:${metric.metricKey}${grainSuffix}:${metric.observedAt.toISOString()}`;

            const observation = await tx.marketingMetricObservation.upsert({
              where: { idempotencyKey },
              create: {
                organisationId: batch.organisationId,
                projectId: batch.projectId,
                brandId: batch.brandId,
                marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                marketingMetricDefinitionId: definition?.id,
                provider: batch.provider,
                source: metricSource,
                metricKey: metric.metricKey,
                metricValue: metric.metricValue,
                observedAt: metric.observedAt,
                periodGrain: metric.grain,
                dimensions: metric.dimensions as Prisma.InputJsonValue,
                marketingSearchQueryId:
                  dimensionIds.searchQuery ??
                  (metric.dimensionProviderIds?.searchQuery
                    ? (
                        await tx.marketingSearchQuery.findFirst({
                          where: {
                            brandId: batch.brandId,
                            provider: batch.provider,
                            providerQueryId: metric.dimensionProviderIds.searchQuery,
                          },
                        })
                      )?.id
                    : undefined),
                marketingLandingPageId:
                  dimensionIds.landingPage ??
                  (metric.dimensionProviderIds?.landingPage
                    ? (
                        await tx.marketingLandingPage.findFirst({
                          where: {
                            brandId: batch.brandId,
                            provider: batch.provider,
                            providerPageId: metric.dimensionProviderIds.landingPage,
                          },
                        })
                      )?.id
                    : undefined),
                marketingGeographyId:
                  dimensionIds.geography ??
                  (metric.dimensionProviderIds?.geography
                    ? (
                        await tx.marketingGeography.findFirst({
                          where: {
                            brandId: batch.brandId,
                            provider: batch.provider,
                            providerGeographyId: metric.dimensionProviderIds.geography,
                          },
                        })
                      )?.id
                    : undefined),
                marketingDeviceId:
                  dimensionIds.device ??
                  (metric.dimensionProviderIds?.device
                    ? (
                        await tx.marketingDevice.findFirst({
                          where: {
                            brandId: batch.brandId,
                            provider: batch.provider,
                            providerDeviceId: metric.dimensionProviderIds.device,
                          },
                        })
                      )?.id
                    : undefined),
                marketingChannelId: dimensionIds.channel,
                marketingAccountId: dimensionIds.account,
                marketingCampaignId: dimensionIds.campaign,
                marketingAdGroupId: dimensionIds.adGroup,
                marketingAdId: dimensionIds.ad,
                marketingCreativeId: dimensionIds.creative,
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

          for (const cost of result.costRecords ?? []) {
            const costIdempotencyKey = `cost:${current.id}:${cost.providerCostId}`;
            await tx.marketingCostRecord.upsert({
              where: { idempotencyKey: costIdempotencyKey },
              create: {
                organisationId: batch.organisationId,
                projectId: batch.projectId,
                brandId: batch.brandId,
                marketingDataSourceAccountId: batch.marketingDataSourceAccountId,
                marketingAccountId: dimensionIds.account,
                marketingCampaignId: dimensionIds.campaign,
                marketingAdGroupId: dimensionIds.adGroup,
                marketingAdId: dimensionIds.ad,
                marketingChannelId: dimensionIds.channel,
                provider: batch.provider,
                providerCostId: cost.providerCostId,
                amount: cost.amount,
                currency: cost.currency,
                periodStart: cost.periodStart,
                periodEnd: cost.periodEnd,
                idempotencyKey: costIdempotencyKey,
                providerMetadata: cost.metadata as Prisma.InputJsonValue,
              },
              update: {
                amount: cost.amount,
                currency: cost.currency,
                providerMetadata: cost.metadata as Prisma.InputJsonValue,
              },
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
                source: metricSourceForProvider(batch.provider),
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
