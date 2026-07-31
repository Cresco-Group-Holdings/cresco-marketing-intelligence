import { z } from "zod";
import {
  AdvertisingAudienceDataSource,
  AdvertisingAudienceExclusionType,
  AdvertisingAudienceIntelligenceType,
  AdvertisingAudienceRuleOperator,
} from "@prisma/client";

export const createAudienceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  audienceType: z.nativeEnum(AdvertisingAudienceIntelligenceType),
  campaignPlanId: z.string().optional(),
  brandAudienceId: z.string().optional(),
  retargetingWindowDays: z.number().int().positive().max(180).optional(),
  dataSources: z.array(z.nativeEnum(AdvertisingAudienceDataSource)).default([]),
});

export const addRuleSchema = z.object({
  ruleKey: z.string(),
  operator: z.nativeEnum(AdvertisingAudienceRuleOperator),
  value: z.unknown(),
  logicGroup: z.string().default("AND"),
});

export const addExclusionSchema = z.object({
  exclusionType: z.nativeEnum(AdvertisingAudienceExclusionType),
  description: z.string().optional(),
  ruleKey: z.string().optional(),
});

export const consentPolicySchema = z.object({
  marketingConsentRequired: z.boolean().default(true),
  dataSources: z.array(z.nativeEnum(AdvertisingAudienceDataSource)).default([]),
  retentionDays: z.number().int().positive().optional(),
  permittedPurpose: z.string().optional(),
  customerListEligible: z.boolean().default(false),
  deletionExcluded: z.boolean().default(true),
  geoRestrictions: z.array(z.string()).default([]),
});
