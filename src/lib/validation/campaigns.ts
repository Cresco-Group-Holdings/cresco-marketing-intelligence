import {
  CampaignActivityType,
  CampaignBudgetType,
  CampaignChannelStatus,
  CampaignChannelType,
  CampaignKpiSourceType,
  CampaignLifecycleStage,
  CampaignMemberRole,
  CampaignObjective,
  CampaignStatus,
} from "@prisma/client";
import { z } from "zod";

const optionalTrimmed = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const campaignListFiltersSchema = z.object({
  brandId: z.string().optional(),
  projectId: z.string().optional(),
  status: z.nativeEnum(CampaignStatus).optional(),
  lifecycleStage: z.nativeEnum(CampaignLifecycleStage).optional(),
  ownerUserId: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  includeArchived: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const campaignCreateSchema = z.object({
  brandId: z.string(),
  name: z.string().trim().min(1).max(200),
  description: optionalTrimmed(5000),
  status: z.nativeEnum(CampaignStatus).optional(),
  lifecycleStage: z.nativeEnum(CampaignLifecycleStage).optional(),
  primaryObjective: z.nativeEnum(CampaignObjective).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  budgetType: z.nativeEnum(CampaignBudgetType).optional().nullable(),
  budgetAmount: z.number().nonnegative().optional().nullable(),
  budgetCurrency: z.string().trim().length(3).optional().nullable(),
  strategyNarrative: optionalTrimmed(10000),
  strategyTargetOutcomes: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
  audienceDescription: optionalTrimmed(5000),
  audienceSegments: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  targetAudienceId: z.string().optional().nullable(),
  ownerUserId: z.string().optional(),
  channels: z
    .array(
      z.object({
        channelType: z.nativeEnum(CampaignChannelType),
        name: optionalTrimmed(200),
        provider: optionalTrimmed(120),
        budgetAmount: z.number().nonnegative().optional().nullable(),
        notes: optionalTrimmed(2000),
      }),
    )
    .max(20)
    .optional(),
  kpis: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        targetValue: z.number().optional().nullable(),
        unit: optionalTrimmed(40),
      }),
    )
    .max(30)
    .optional(),
  memberUserIds: z.array(z.string()).max(50).optional(),
});

export const campaignUpdateSchema = campaignCreateSchema
  .omit({ brandId: true })
  .extend({
    version: z.number().int().positive(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const campaignTransitionSchema = z.object({
  action: z.enum([
    "plan",
    "markReady",
    "activate",
    "pause",
    "resume",
    "complete",
    "cancel",
    "archive",
    "restore",
    "reopen",
  ]),
  version: z.number().int().positive(),
});

export const campaignChannelCreateSchema = z.object({
  channelType: z.nativeEnum(CampaignChannelType),
  status: z.nativeEnum(CampaignChannelStatus).optional(),
  name: optionalTrimmed(200),
  provider: optionalTrimmed(120),
  budgetAmount: z.number().nonnegative().optional().nullable(),
  budgetCurrency: z.string().trim().length(3).optional().nullable(),
  notes: optionalTrimmed(2000),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  externalRef: optionalTrimmed(200),
  metadata: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const campaignChannelUpdateSchema = campaignChannelCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided." },
);

export const campaignKpiCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  metricKey: optionalTrimmed(120),
  targetValue: z.number().optional().nullable(),
  currentValue: z.number().optional().nullable(),
  unit: optionalTrimmed(40),
  sourceType: z.nativeEnum(CampaignKpiSourceType).optional(),
  sourceRef: optionalTrimmed(200),
  sortOrder: z.number().int().min(0).optional(),
});

export const campaignKpiUpdateSchema = campaignKpiCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: "At least one field must be provided." },
);

export const campaignMemberCreateSchema = z.object({
  userId: z.string(),
  role: z.nativeEnum(CampaignMemberRole).optional(),
});

export const campaignMemberUpdateSchema = z.object({
  role: z.nativeEnum(CampaignMemberRole),
});

export const campaignActivityListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  activityType: z.nativeEnum(CampaignActivityType).optional(),
});

export type CampaignListFilters = z.infer<typeof campaignListFiltersSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;
export type CampaignTransitionInput = z.infer<typeof campaignTransitionSchema>;
export type CampaignChannelCreateInput = z.infer<typeof campaignChannelCreateSchema>;
export type CampaignChannelUpdateInput = z.infer<typeof campaignChannelUpdateSchema>;
export type CampaignKpiCreateInput = z.infer<typeof campaignKpiCreateSchema>;
export type CampaignKpiUpdateInput = z.infer<typeof campaignKpiUpdateSchema>;
export type CampaignMemberCreateInput = z.infer<typeof campaignMemberCreateSchema>;
export type CampaignMemberUpdateInput = z.infer<typeof campaignMemberUpdateSchema>;
