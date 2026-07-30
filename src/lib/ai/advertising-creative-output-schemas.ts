import { z } from "zod";

export const advertisingCreativeConceptSchema = z.object({
  category: z.string(),
  campaignObjective: z.string(),
  audienceSummary: z.string(),
  message: z.string(),
  visualDirection: z.string(),
  cta: z.string(),
  hypothesis: z.string(),
  complianceRisk: z.string(),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  uncertainty: z.array(z.string()),
  recommendedHumanReview: z.array(z.string()),
  disclaimer: z.string(),
});

export const advertisingCreativeCopySchema = z.object({
  fields: z.array(
    z.object({
      fieldKey: z.string(),
      value: z.string(),
      rationale: z.string().optional(),
    }),
  ),
  conceptSummary: z.string(),
  evidence: z.array(z.string()),
  assumptions: z.array(z.string()),
  missingInformation: z.array(z.string()),
  complianceRisks: z.array(z.string()),
  recommendedHumanReview: z.array(z.string()),
  disclaimer: z.string(),
});

export type AdvertisingCreativeConceptOutput = z.infer<typeof advertisingCreativeConceptSchema>;
export type AdvertisingCreativeCopyOutput = z.infer<typeof advertisingCreativeCopySchema>;

export const ADVERTISING_CREATIVE_OUTPUT_SCHEMAS = {
  "advertising.creatives.concepts": advertisingCreativeConceptSchema,
  "advertising.creatives.copy": advertisingCreativeCopySchema,
} as const;
