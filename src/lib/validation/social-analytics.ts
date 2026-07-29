import { SocialProvider } from "@prisma/client";
import { z } from "zod";
import { isSupportedTimeZone } from "@/lib/analytics/timezone";

const timezone = z
  .string()
  .min(1)
  .max(64)
  .refine(isSupportedTimeZone, "Unsupported analytics timezone identifier.")
  .optional();

export const socialAnalyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  timezone,
  granularity: z.enum(["DAY", "WEEK", "MONTH"]).optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  socialAccountId: z.string().optional(),
  projectId: z.string().optional(),
  campaign: z.string().max(200).optional(),
  contentType: z.string().max(50).optional(),
  contentPillar: z.string().max(200).optional(),
  contentItemId: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const socialAnalyticsAttributionSchema = socialAnalyticsQuerySchema.extend({
  dimension: z
    .enum(["CONTENT_ITEM", "CAMPAIGN", "CONTENT_PILLAR", "CONTENT_TYPE", "OWNER", "PLATFORM"])
    .default("CONTENT_ITEM"),
});

export const socialAnalyticsSyncSchema = z.object({
  socialAccountId: z.string(),
  syncType: z.enum(["INITIAL", "INCREMENTAL", "SCHEDULED", "BACKFILL"]).default("INCREMENTAL"),
  idempotencyKey: z.string().min(12).max(160),
  scheduledFor: z.string().datetime().optional(),
  backfillFrom: z.string().datetime().optional(),
  backfillTo: z.string().datetime().optional(),
});

export const socialAnalyticsExportSchema = socialAnalyticsAttributionSchema.extend({
  scope: z.enum(["POST", "ACCOUNT", "ATTRIBUTION"]),
  format: z.enum(["CSV", "JSON"]),
});
