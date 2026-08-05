import { z } from "zod";
import { ALL_METRIC_KEYS } from "@/lib/analytics-core/constants";

const metricKeySchema = z.enum(ALL_METRIC_KEYS as unknown as [string, ...string[]]);

export const analyticsGranularitySchema = z.enum(["HOUR", "DAY", "WEEK", "MONTH", "TOTAL"]);

export const analyticsFactQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
  channel: z.string().optional(),
  provider: z.string().optional(),
  metricKeys: z
    .preprocess(
      (value) =>
        typeof value === "string" && value.length > 0
          ? value.split(",").map((key) => key.trim())
          : undefined,
      z.array(z.string()).optional(),
    ),
  granularity: analyticsGranularitySchema.optional(),
  currency: z.string().length(3).optional(),
});

export const analyticsImportRowSchema = z.object({
  metricKey: metricKeySchema,
  value: z.coerce.number().finite(),
  occurredAt: z.string().datetime(),
  granularity: analyticsGranularitySchema.default("DAY"),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
  channel: z.string().optional(),
  provider: z.string().optional(),
  currency: z.string().length(3).optional(),
  dimensions: z.record(z.string(), z.unknown()).optional(),
});

export const analyticsManualImportSchema = z.object({
  dataSourceId: z.string().optional(),
  fileName: z.string().optional(),
  rows: z.array(analyticsImportRowSchema).min(1).max(5000),
});

export const analyticsSnapshotCreateSchema = z.object({
  name: z.string().min(1).max(200),
  periodFrom: z.string().datetime(),
  periodTo: z.string().datetime(),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
});

export const analyticsDashboardFiltersSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  projectId: z.string().optional(),
  brandId: z.string().optional(),
  campaignId: z.string().optional(),
  channel: z.string().optional(),
  currency: z.string().length(3).optional(),
});

export type AnalyticsFactQueryInput = z.infer<typeof analyticsFactQuerySchema>;
export type AnalyticsImportRowInput = z.infer<typeof analyticsImportRowSchema>;
export type AnalyticsManualImportInput = z.infer<typeof analyticsManualImportSchema>;
export type AnalyticsSnapshotCreateInput = z.infer<typeof analyticsSnapshotCreateSchema>;
export type AnalyticsDashboardFiltersInput = z.infer<typeof analyticsDashboardFiltersSchema>;
