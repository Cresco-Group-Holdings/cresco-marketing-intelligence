import { z } from "zod";

export const advertisingPlanAiOutputSchema = z.object({
  campaignStructure: z.array(z.object({
    channel: z.string(),
    campaignType: z.string(),
    rationale: z.string(),
  })),
  recommendedObjective: z.string(),
  channelMix: z.array(z.object({
    channel: z.string(),
    budgetPercent: z.number().min(0).max(100),
    rationale: z.string(),
  })),
  audienceHypotheses: z.array(z.object({
    name: z.string(),
    type: z.string(),
    rationale: z.string(),
  })),
  creativeFormats: z.array(z.string()),
  messageAngles: z.array(z.string()),
  budgetDistribution: z.object({
    totalAmount: z.number().optional(),
    currency: z.string(),
    byChannel: z.record(z.string(), z.number()).optional(),
  }),
  testingPlan: z.string(),
  measurementPlan: z.string(),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainty: z.array(z.string()),
  missingInformation: z.array(z.string()),
  risks: z.array(z.string()),
  recommendedHumanReview: z.array(z.string()),
  disclaimer: z.string(),
});

export type AdvertisingPlanAiOutput = z.infer<typeof advertisingPlanAiOutputSchema>;

export const ADVERTISING_PLAN_OUTPUT_SCHEMAS = {
  "advertising.plans.generate": advertisingPlanAiOutputSchema,
} as const;
