import { SocialProvider } from "@prisma/client";
import { z } from "zod";

export const socialAnalyticsQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  provider: z.nativeEnum(SocialProvider).optional(),
  socialAccountId: z.string().optional(),
  projectId: z.string().optional(),
  campaign: z.string().max(200).optional(),
  contentType: z.string().max(50).optional(),
  contentItemId: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const socialAnalyticsSyncSchema = z.object({
  socialAccountId: z.string(),
  syncType: z.enum(["INITIAL", "INCREMENTAL", "SCHEDULED"]).default("INCREMENTAL"),
  idempotencyKey: z.string().min(12).max(160),
  scheduledFor: z.string().datetime().optional(),
});

export const socialAnalyticsExportSchema = socialAnalyticsQuerySchema.extend({
  scope: z.enum(["POST", "ACCOUNT"]),
  format: z.enum(["CSV", "JSON"]),
});
