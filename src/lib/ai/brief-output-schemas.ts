import { z } from "zod";

export const seoBriefOutputSchema = z.object({
  workingTitle: z.string(),
  contentType: z.string(),
  audience: z.string(),
  userProblem: z.string(),
  primaryIntent: z.string(),
  primaryKeyword: z.string(),
  secondaryKeywords: z.array(z.string()),
  entities: z.array(z.object({ type: z.string(), value: z.string() })),
  recommendedAngle: z.string(),
  differentiators: z.array(z.string()),
  outline: z.array(z.string()),
  headings: z.array(z.object({ level: z.number(), text: z.string(), notes: z.string().optional() })),
  questionsToAnswer: z.array(z.string()),
  faq: z.array(z.object({ question: z.string(), answerGuidance: z.string() })),
  internalLinkConcepts: z.array(
    z.object({
      destinationConcept: z.string(),
      anchorConcept: z.string(),
      reason: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  externalEvidenceNeeds: z.array(z.string()),
  schemaSuggestions: z.array(
    z.object({
      schemaType: z.string(),
      rationale: z.string(),
      eligibilityNote: z.string().optional(),
    }),
  ),
  cta: z.string(),
  tone: z.string(),
  targetLengthMin: z.number().optional(),
  targetLengthMax: z.number().optional(),
  eeatChecklist: z.array(z.string()),
  complianceWarnings: z.array(z.string()),
  successMetrics: z.array(z.string()),
  limitations: z.string(),
  originalityGuidance: z.string(),
});

export const BRIEF_OUTPUT_SCHEMAS = {
  "seo.briefs.generate": seoBriefOutputSchema,
} as const;
