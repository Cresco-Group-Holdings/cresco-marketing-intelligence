import { z } from "zod";
import { AdvertisingApprovalType, AdvertisingBudgetType, AdvertisingChannelType, AdvertisingPlanObjectiveType } from "@prisma/client";

export const createPlanSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  primaryObjective: z.nativeEnum(AdvertisingPlanObjectiveType).optional(),
  reportingCurrency: z.string().length(3).default("USD"),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  totalBudgetAmount: z.number().positive().optional(),
});

export const addChannelSchema = z.object({
  channelType: z.nativeEnum(AdvertisingChannelType),
  provider: z.string().optional(),
  intendedCampaignType: z.string().optional(),
});

export const addBudgetSchema = z.object({
  channelId: z.string().optional(),
  budgetType: z.nativeEnum(AdvertisingBudgetType),
  currency: z.string().length(3),
  amount: z.number().positive(),
  pacingMethod: z.enum(["EVEN", "ACCELERATED", "STANDARD"]).optional(),
  plannedStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),
});

export const addAudienceSchema = z.object({
  audienceType: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  logicSpec: z.record(z.string(), z.unknown()).default({}),
  brandAudienceId: z.string().optional(),
  isExclusion: z.boolean().default(false),
});

export const addConversionGoalSchema = z.object({
  conversionDefinitionId: z.string().optional(),
  isPrimary: z.boolean().default(false),
  conversionValue: z.number().optional(),
  valueCurrency: z.string().length(3).optional(),
  attributionModel: z.string().optional(),
});

export const addDestinationSchema = z.object({
  destinationType: z.string(),
  destinationUrl: z.string().url().optional(),
  utmTemplate: z.string().optional(),
  mobileUrl: z.string().url().optional(),
  crawlPageId: z.string().optional(),
});

export const approvalActionSchema = z.object({
  approvalType: z.nativeEnum(AdvertisingApprovalType),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  decisionNote: z.string().max(2000).optional(),
});
