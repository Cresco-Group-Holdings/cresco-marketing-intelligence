import { z } from "zod";

export const advertisingAudienceAiOutputSchema = z.object({
  audienceHypothesis: z.string(),
  recommendedType: z.string(),
  exclusions: z.array(z.string()),
  funnelStage: z.string(),
  messageAngle: z.string(),
  creativeAdaptation: z.string(),
  measurementPlan: z.string(),
  dataSources: z.array(z.string()),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainty: z.array(z.string()),
  privacyRisks: z.array(z.string()),
  prohibitedTargetingWarnings: z.array(z.string()),
  recommendedHumanReview: z.array(z.string()),
  disclaimer: z.string(),
});

export type AdvertisingAudienceAiOutput = z.infer<typeof advertisingAudienceAiOutputSchema>;

export const ADVERTISING_AUDIENCE_OUTPUT_SCHEMAS = {
  "advertising.audiences.plan": advertisingAudienceAiOutputSchema,
} as const;
