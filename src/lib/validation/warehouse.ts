import {
  DataQualityResolutionAction,
  MarketingConversionType,
  MarketingDataProvider,
  RawMarketingBatchSyncType,
} from "@prisma/client";
import { z } from "zod";
import {
  WAREHOUSE_DEFAULT_LIST_LIMIT,
  WAREHOUSE_MAX_LIST_LIMIT,
} from "@/lib/warehouse/constants";
import {
  AGGREGATE_GROUP_BY_ALLOWLIST,
  AGGREGATE_SORT_ALLOWLIST,
  EVENT_GROUP_BY_ALLOWLIST,
  EVENT_SORT_ALLOWLIST,
  METRIC_GROUP_BY_ALLOWLIST,
  METRIC_SORT_ALLOWLIST,
} from "@/lib/warehouse/query-allowlist";

const brandScopedQuery = z.object({
  brandId: z.string().min(1),
  projectId: z.string().optional(),
});

const dateRange = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

const pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(WAREHOUSE_MAX_LIST_LIMIT).default(WAREHOUSE_DEFAULT_LIST_LIMIT),
});

export const warehouseIngestRecordSchema = z.object({
  providerRecordId: z.string().min(1).max(200),
  recordType: z.string().min(1).max(100).default("metric"),
  eventTime: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const warehouseIngestBatchSchema = z.object({
  brandId: z.string().min(1),
  marketingDataSourceAccountId: z.string().min(1),
  syncType: z.nativeEnum(RawMarketingBatchSyncType).default("MANUAL"),
  idempotencyKey: z.string().min(12).max(160),
  records: z.array(warehouseIngestRecordSchema).min(1).max(5000),
});

export const warehouseCreateBatchSchema = z.object({
  brandId: z.string().min(1),
  marketingDataSourceAccountId: z.string().min(1).optional(),
  provider: z.nativeEnum(MarketingDataProvider).default("MANUAL_IMPORT"),
  syncType: z.nativeEnum(RawMarketingBatchSyncType).default("MANUAL"),
  idempotencyKey: z.string().min(12).max(160),
  records: z.array(warehouseIngestRecordSchema).optional(),
});

export const warehouseMetricsQuerySchema = brandScopedQuery
  .merge(dateRange)
  .merge(pagination)
  .extend({
    metricKey: z.string().optional(),
    provider: z.nativeEnum(MarketingDataProvider).optional(),
    groupBy: z.array(z.enum(METRIC_GROUP_BY_ALLOWLIST)).max(3).optional(),
    sortBy: z.enum(METRIC_SORT_ALLOWLIST).optional(),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  });

export const warehouseEventsQuerySchema = brandScopedQuery
  .merge(dateRange)
  .merge(pagination)
  .extend({
    eventName: z.string().optional(),
    provider: z.nativeEnum(MarketingDataProvider).optional(),
    groupBy: z.array(z.enum(EVENT_GROUP_BY_ALLOWLIST)).max(3).optional(),
    sortBy: z.enum(EVENT_SORT_ALLOWLIST).optional(),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  });

export const warehouseConversionsQuerySchema = brandScopedQuery.merge(pagination).extend({
  provider: z.nativeEnum(MarketingDataProvider).optional(),
  activeOnly: z.coerce.boolean().optional(),
});

export const warehouseConversionCreateSchema = z.object({
  brandId: z.string().min(1),
  provider: z.nativeEnum(MarketingDataProvider),
  conversionKey: z.string().min(1).max(120),
  displayName: z.string().min(1).max(200),
  conversionType: z.nativeEnum(MarketingConversionType).default("GOAL"),
  valueCurrency: z.string().length(3).optional(),
});

export const warehouseRevenueQuerySchema = brandScopedQuery.merge(dateRange).merge(pagination);

export const warehouseCostsQuerySchema = brandScopedQuery.merge(dateRange).merge(pagination).extend({
  marketingCampaignId: z.string().optional(),
});

export const warehouseQualityListSchema = brandScopedQuery.merge(pagination).extend({
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "SUPPRESSED"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export const warehouseQualityResolveSchema = z.object({
  brandId: z.string().min(1),
  issueId: z.string().min(1),
  action: z.nativeEnum(DataQualityResolutionAction),
  notes: z.string().max(2000).optional(),
});

export const warehouseReprocessSchema = z.object({
  brandId: z.string().min(1),
  batchId: z.string().optional(),
  recordIds: z.array(z.string()).max(1000).optional(),
  idempotencyKey: z.string().min(12).max(160),
});

export const warehouseAggregateRefreshSchema = z.object({
  brandId: z.string().min(1),
  from: z.string().datetime(),
  to: z.string().datetime(),
  metricKeys: z.array(z.string()).max(50).optional(),
  idempotencyKey: z.string().min(12).max(160),
});

export const warehouseAggregatesListSchema = brandScopedQuery
  .merge(dateRange)
  .merge(pagination)
  .extend({
    metricKey: z.string().optional(),
    groupBy: z.array(z.enum(AGGREGATE_GROUP_BY_ALLOWLIST)).max(3).optional(),
    sortBy: z.enum(AGGREGATE_SORT_ALLOWLIST).optional(),
    sortDirection: z.enum(["asc", "desc"]).default("desc"),
  });

export const warehouseManualImportCreateSchema = z.object({
  brandId: z.string().min(1),
  fileName: z.string().min(1).max(255),
  csvContent: z.string().min(1),
  idempotencyKey: z.string().min(12).max(160),
  columnMappings: z
    .array(
      z.object({
        sourceColumn: z.string().min(1),
        targetField: z.string().min(1),
        isRequired: z.boolean().optional(),
      }),
    )
    .optional(),
});

export const warehouseManualImportConfirmSchema = z.object({
  brandId: z.string().min(1),
  importId: z.string().min(1),
});

export const warehouseBatchesListSchema = brandScopedQuery.merge(pagination).extend({
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "PARTIAL", "FAILED", "CANCELLED"]).optional(),
});

export const warehouseHealthListSchema = brandScopedQuery;

export const warehouseSourcesListSchema = brandScopedQuery;

export const warehouseImportsListSchema = brandScopedQuery.merge(pagination);

export type WarehouseIngestBatchInput = z.infer<typeof warehouseIngestBatchSchema>;
export type WarehouseMetricsQueryInput = z.infer<typeof warehouseMetricsQuerySchema>;
export type WarehouseEventsQueryInput = z.infer<typeof warehouseEventsQuerySchema>;
export type WarehouseAggregateRefreshInput = z.infer<typeof warehouseAggregateRefreshSchema>;
