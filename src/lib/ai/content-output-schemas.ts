import { z } from "zod";
import { SocialProvider } from "@prisma/client";

export const platformAdaptationSchema = z.object({
  provider: z.nativeEnum(SocialProvider),
  caption: z.string().min(1).max(5000),
  headline: z.string().max(500).optional(),
  hashtags: z.array(z.string().max(100)).max(30),
  hook: z.string().max(500).optional(),
  cta: z.string().max(300).optional(),
  firstComment: z.string().max(2000).optional(),
});

export const socialContentOutputSchema = z.object({
  hook: z.string().min(1).max(500),
  body: z.string().min(1).max(10000),
  caption: z.string().min(1).max(5000),
  headline: z.string().max(500).optional(),
  cta: z.string().min(1).max(300),
  hashtags: z.array(z.string().max(100)).max(30),
  videoScript: z.string().max(10000).optional(),
  sceneSuggestions: z.array(z.string().max(500)).max(10).optional(),
  visualBrief: z.string().max(2000).optional(),
  complianceNotes: z.array(z.string().max(500)).max(10).optional(),
  platformAdaptations: z.array(platformAdaptationSchema).min(1).max(6),
  safetyFlags: z.array(z.string().max(200)).max(20).optional(),
});

export const contentHashtagsOutputSchema = z.object({
  hashtags: z.array(z.string().max(100)).min(1).max(30),
  rationale: z.string().max(1000).optional(),
});

export const contentTransformOutputSchema = z.object({
  result: z.string().min(1).max(10000),
  notes: z.string().max(1000).optional(),
});

export const contentIdeasOutputSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        angle: z.string().max(1000),
        suggestedPlatforms: z.array(z.nativeEnum(SocialProvider)).max(6),
        contentPillar: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(10),
});

export type SocialContentOutput = z.infer<typeof socialContentOutputSchema>;
export type ContentIdeasOutput = z.infer<typeof contentIdeasOutputSchema>;

export const CONTENT_OUTPUT_SCHEMAS = {
  "content.social.post": socialContentOutputSchema,
  "content.linkedin.post": socialContentOutputSchema,
  "content.facebook.post": socialContentOutputSchema,
  "content.x.thread": socialContentOutputSchema,
  "content.carousel.copy": socialContentOutputSchema,
  "content.youtube.metadata": socialContentOutputSchema,
  "content.video.script": socialContentOutputSchema,
  "content.repurpose": socialContentOutputSchema,
  "content.platform.adapt": socialContentOutputSchema,
  "content.rewrite": contentTransformOutputSchema,
  "content.transform": contentTransformOutputSchema,
  "content.cta.improve": contentTransformOutputSchema,
  "content.hashtags": contentHashtagsOutputSchema,
  "content.ideas": contentIdeasOutputSchema,
} as const;

export type ContentOutputSchemaKey = keyof typeof CONTENT_OUTPUT_SCHEMAS;
