import { z } from "zod";

export const longFormOutlineSchema = z.object({
  title: z.string(),
  metaDescription: z.string().optional(),
  slug: z.string().optional(),
  sections: z.array(
    z.object({
      heading: z.string(),
      headingLevel: z.number().min(1).max(6).default(2),
      blockType: z.string().default("PARAGRAPH"),
      summary: z.string(),
      targetWordCount: z.number().optional(),
      evidenceNeeds: z.array(z.string()).optional(),
    }),
  ),
  complianceNotes: z.array(z.string()).optional(),
  seoNotes: z.array(z.string()).optional(),
});

export const longFormSectionSchema = z.object({
  heading: z.string().optional(),
  headingLevel: z.number().min(1).max(6).optional(),
  blockType: z.string().default("PARAGRAPH"),
  body: z.string(),
  claims: z.array(
    z.object({
      claimText: z.string(),
      classification: z.string(),
      requiresCitation: z.boolean(),
      suggestedCitation: z.string().optional(),
    }),
  ).optional(),
  citations: z.array(
    z.object({
      label: z.string(),
      url: z.string().optional(),
      sourceType: z.string().optional(),
    }),
  ).optional(),
  tone: z.string().optional(),
  limitations: z.string().optional(),
});

export const LONG_FORM_OUTPUT_SCHEMAS = {
  "longForm.outline.generate": longFormOutlineSchema,
  "longForm.section.generate": longFormSectionSchema,
} as const;
