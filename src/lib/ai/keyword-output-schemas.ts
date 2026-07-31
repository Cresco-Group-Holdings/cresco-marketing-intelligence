import { z } from "zod";

export const keywordEntityExtractionSchema = z.object({
  entities: z.array(
    z.object({
      entityType: z.enum([
        "PRODUCT",
        "ORGANISATION",
        "LOCATION",
        "SECTOR",
        "SERVICE",
        "PROBLEM",
        "AUDIENCE",
        "REGULATION",
        "TECHNOLOGY",
        "OTHER",
      ]),
      canonicalValue: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export const keywordSuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      keyword: z.string(),
      rationale: z.string(),
      suggestedIntent: z
        .enum([
          "INFORMATIONAL",
          "NAVIGATIONAL",
          "COMMERCIAL",
          "TRANSACTIONAL",
          "LOCAL",
          "SUPPORT",
          "MIXED",
          "UNKNOWN",
        ])
        .optional(),
    }),
  ),
  disclaimer: z.string(),
});

export const keywordIntentAiSchema = z.object({
  intent: z.enum([
    "INFORMATIONAL",
    "NAVIGATIONAL",
    "COMMERCIAL",
    "TRANSACTIONAL",
    "LOCAL",
    "SUPPORT",
    "MIXED",
    "UNKNOWN",
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const KEYWORD_OUTPUT_SCHEMAS = {
  "seo.keywords.suggest": keywordSuggestionSchema,
  "seo.keywords.entities": keywordEntityExtractionSchema,
  "seo.keywords.intent": keywordIntentAiSchema,
} as const;

export type KeywordOutputSchemaKey = keyof typeof KEYWORD_OUTPUT_SCHEMAS;
