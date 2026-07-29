import {
  ExperimentMetricRole,
  SocialExperimentMode,
  SocialExperimentStatus,
  SocialExperimentTestType,
  SocialProvider,
} from "@prisma/client";
import { z } from "zod";
import { SUPPORTED_METRIC_KEYS } from "@/lib/experiments/constants";

export const experimentVariantSchema = z.object({
  label: z.string().min(1).max(40),
  contentItemId: z.string().optional(),
  contentVariantId: z.string().optional(),
  provider: z.nativeEnum(SocialProvider).optional(),
  scheduledFor: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  hasPaidPromotion: z.coerce.boolean().optional(),
  contentTopic: z.string().max(300).optional(),
  hookText: z.string().max(500).optional(),
  captionText: z.string().max(4000).optional(),
  ctaText: z.string().max(300).optional(),
  contentPillar: z.string().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const experimentMetricSchema = z.object({
  metricKey: z.enum(SUPPORTED_METRIC_KEYS),
  role: z.nativeEnum(ExperimentMetricRole),
  label: z.string().max(120).optional(),
  normalisationMethod: z.enum(["none", "per_impression", "per_engagement"]).optional(),
});

export const experimentCreateSchema = z.object({
  title: z.string().min(1).max(300),
  testType: z.nativeEnum(SocialExperimentTestType),
  mode: z.nativeEnum(SocialExperimentMode).default("OBSERVATIONAL"),
  targetProvider: z.nativeEnum(SocialProvider),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  minimumSampleThreshold: z.coerce.number().int().min(1).max(1_000_000),
  decisionRule: z.string().min(1).max(2000),
  confoundingFactorNotes: z.string().max(4000).optional(),
  hypothesis: z.object({
    statement: z.string().min(1).max(2000),
    expectedDirection: z.string().max(200).optional(),
    rationale: z.string().max(4000).optional(),
  }),
  variants: z.array(experimentVariantSchema).min(2).max(6),
  metrics: z
    .array(experimentMetricSchema)
    .min(1)
    .refine((metrics) => metrics.some((metric) => metric.role === "PRIMARY"), {
      message: "A primary metric is required.",
    }),
});

export const experimentUpdateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  status: z.nativeEnum(SocialExperimentStatus).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minimumSampleThreshold: z.coerce.number().int().min(1).max(1_000_000).optional(),
  decisionRule: z.string().min(1).max(2000).optional(),
  confoundingFactorNotes: z.string().max(4000).optional(),
  cancelledReason: z.string().max(2000).optional(),
});

export const experimentReuseSchema = z.object({
  reuseType: z.enum([
    "CONTENT_PATTERN",
    "GROWTH_RECOMMENDATION",
    "BRAND_MESSAGING_NOTE",
    "CONTENT_STUDIO_GUIDANCE",
  ]),
  summary: z.string().max(4000).optional(),
  confirmed: z.boolean().refine((value) => value === true, {
    message: "User confirmation is required before reuse.",
  }),
});

export const experimentListFiltersSchema = z.object({
  status: z.nativeEnum(SocialExperimentStatus).optional(),
  testType: z.nativeEnum(SocialExperimentTestType).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type ExperimentCreateInput = z.infer<typeof experimentCreateSchema>;
export type ExperimentUpdateInput = z.infer<typeof experimentUpdateSchema>;
export type ExperimentReuseInput = z.infer<typeof experimentReuseSchema>;
export type ExperimentListFilters = z.infer<typeof experimentListFiltersSchema>;
