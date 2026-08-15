import { z } from "zod";
import { SYNC_RESOURCE_TYPES } from "@/lib/integrations/sync/constants";

export const updateSyncConfigSchema = z.object({
  schedule: z.enum(["MANUAL", "HOURLY", "EVERY_6_HOURS", "DAILY", "WEEKLY", "CUSTOM"]).optional(),
  customIntervalMinutes: z.number().int().positive().optional(),
  resourceTypes: z.array(z.enum(SYNC_RESOURCE_TYPES)).optional(),
  backfillDays: z.number().int().min(1).max(365).optional(),
  timezone: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const runSyncSchema = z.object({
  syncMode: z
    .enum(["FULL", "INCREMENTAL", "BACKFILL", "MANUAL", "SCHEDULED", "WEBHOOK", "RETRY"])
    .optional(),
  resourceTypes: z.array(z.enum(SYNC_RESOURCE_TYPES)).optional(),
  dateRangeStart: z.string().datetime().optional(),
  dateRangeEnd: z.string().datetime().optional(),
});

export const campaignMappingSchema = z.object({
  externalResourceId: z.string().min(1),
  mappingPolicy: z.enum([
    "EXTERNAL_ONLY",
    "LINKED_TO_INTERNAL",
    "IMPORTED_AS_INTERNAL",
    "IGNORED",
    "ARCHIVED_EXTERNALLY",
  ]),
  internalCampaignId: z.string().optional(),
  externalName: z.string().optional(),
});

export const retryFailuresSchema = z.object({
  failureIds: z.array(z.string()).optional(),
});
