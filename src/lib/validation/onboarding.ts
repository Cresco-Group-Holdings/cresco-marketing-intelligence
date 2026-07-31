import { z } from "zod";
import { BrandMarketingChannel, MarketingObjectiveType, OnboardingStepKey } from "@prisma/client";

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const accountProfileStepSchema = z.object({
  displayName: optionalTrimmed(120),
  firstName: optionalTrimmed(80),
  lastName: optionalTrimmed(80),
  timezone: optionalTrimmed(80),
  locale: optionalTrimmed(20),
});

export const organisationStepSchema = z.object({
  name: trimmedString(120),
  slug: trimmedString(120),
  legalName: optionalTrimmed(200),
  website: z.string().trim().url().optional().or(z.literal("")),
  industry: optionalTrimmed(120),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional()
    .or(z.literal("")),
  defaultTimezone: optionalTrimmed(80),
});

export const projectStepSchema = z.object({
  name: trimmedString(120),
  slug: trimmedString(120),
  description: optionalTrimmed(2000),
  website: z.string().trim().url().optional().or(z.literal("")),
  existingProjectId: z.string().cuid().optional(),
});

export const brandStepSchema = z.object({
  name: trimmedString(120),
  slug: trimmedString(120),
  description: optionalTrimmed(2000),
  website: z.string().trim().url().optional().or(z.literal("")),
  existingBrandId: z.string().cuid().optional(),
  existingProjectId: z.string().cuid().optional(),
});

export const brandProfileStepSchema = z.object({
  shortDescription: optionalTrimmed(500),
  targetAudience: optionalTrimmed(2000),
  valueProposition: optionalTrimmed(2000),
  longDescription: optionalTrimmed(5000),
  mission: optionalTrimmed(2000),
});

export const marketingObjectiveInputSchema = z.object({
  objectiveType: z.nativeEnum(MarketingObjectiveType),
  description: trimmedString(2000),
  priority: z.number().int().min(1).max(10),
  targetValue: z.number().positive(),
  targetPeriod: trimmedString(40),
});

export const marketingObjectivesStepSchema = z.object({
  objectives: z.array(marketingObjectiveInputSchema).min(1).max(10),
});

export const channelPreferencesStepSchema = z.object({
  channels: z.array(z.nativeEnum(BrandMarketingChannel)).min(1),
});

export const applyTemplateSchema = z.object({
  templateKey: z.literal("cresco-internal"),
});

export const onboardingStepActionSchema = z.object({
  step: z.nativeEnum(OnboardingStepKey),
  action: z.enum(["save", "back"]).default("save"),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const workspaceContextStepSchema = z.object({
  currentProjectId: z.string().cuid().optional(),
  currentBrandId: z.string().cuid().optional(),
});
