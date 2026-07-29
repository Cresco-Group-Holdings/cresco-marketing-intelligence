import { z } from "zod";
import { RecommendationDraftType, RecommendationFeedbackStatus } from "@prisma/client";
import { socialAnalyticsQuerySchema } from "@/lib/validation/social-analytics";

export const growthAnalyzeSchema = socialAnalyticsQuerySchema;

export const growthFeedbackSchema = z.object({
  feedbackStatus: z.nativeEnum(RecommendationFeedbackStatus),
  reason: z.string().max(2000).optional(),
  outcomeNotes: z.string().max(4000).optional(),
  measuredOutcome: z.record(z.string(), z.unknown()).optional(),
});

export const growthDraftSchema = z.object({
  draftType: z.nativeEnum(RecommendationDraftType),
  title: z.string().min(1).max(300).optional(),
  socialAccountId: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  timezone: z.string().max(100).optional(),
});

export const growthExperimentUpdateSchema = z.object({
  status: z.enum(["PLANNED", "RUNNING", "COMPLETED", "CANCELLED"]).optional(),
  resultSummary: z.string().max(4000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});
