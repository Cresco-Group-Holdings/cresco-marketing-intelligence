import { z } from "zod";

export const leadQualificationSuggestionSchema = z.object({
  profile: z.enum(["CRESCO_GRANTS_INTELLIGENCE", "CAPITAL_CRESCO_TERMINAL"]),
  suggestedQualified: z.boolean(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  answers: z.record(z.string(), z.union([z.string(), z.boolean(), z.null()])),
  rationale: z.string(),
  requiresHumanReview: z.literal(true),
});

export type LeadQualificationSuggestion = z.infer<typeof leadQualificationSuggestionSchema>;

export const LEADS_OUTPUT_SCHEMAS = {
  "leadQualificationSuggestion": leadQualificationSuggestionSchema,
} as const;
