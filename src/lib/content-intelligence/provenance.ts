import { z } from "zod";
import { contentBriefSchema } from "@/lib/content-intelligence/brief";
import type { BriefCreationMode, ContentBrief } from "@/lib/content-intelligence/types";
import type { UsedKnowledgeRecord } from "@/lib/ai/brand-context-builder";

export const CONTENT_INTELLIGENCE_PROVENANCE_SCHEMA_VERSION = 1 as const;

const generationRecordSchema = z.object({
  aiRequestId: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  humanEdited: z.boolean().default(false),
  editedAt: z.string().optional(),
  operationType: z
    .enum(["brief_generation", "master_content_generation", "channel_adaptation", "content_revision"])
    .optional(),
});

const sourceOpportunitySchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string().optional(),
});

export const contentIntelligenceProvenanceSchema = z.object({
  schemaVersion: z.literal(CONTENT_INTELLIGENCE_PROVENANCE_SCHEMA_VERSION),
  briefId: z.string(),
  creationMode: z.enum([
    "manual",
    "campaign",
    "opportunity",
    "winning_content",
    "competitor_signal",
  ]),
  generatedAt: z.string(),
  brandId: z.string(),
  campaignId: z.string().nullable().optional(),
  sourceOpportunity: sourceOpportunitySchema.nullable().optional(),
  structuredBrief: contentBriefSchema,
  originalBrief: contentBriefSchema.optional(),
  briefGeneration: generationRecordSchema.optional(),
  masterGeneration: generationRecordSchema.optional(),
  structuredMaster: z
    .object({
      title: z.string(),
      summary: z.string().nullable().optional(),
      hook: z.string().nullable().optional(),
      body: z.string(),
      keyPoints: z.array(z.string()).default([]),
      cta: z.string().nullable().optional(),
      contentPillar: z.string().nullable().optional(),
      recommendedChannels: z.array(z.string()).optional(),
      riskFlags: z.array(z.string()).optional(),
    })
    .optional(),
  brandKnowledgeSnapshot: z
    .object({
      snapshotAt: z.string(),
      usedRecords: z.array(
        z.object({
          type: z.string(),
          id: z.string(),
          label: z.string(),
        }),
      ),
    })
    .optional(),
  idempotency: z
    .object({
      briefKey: z.string().optional(),
      masterKey: z.string().optional(),
    })
    .optional(),
});

export type ContentIntelligenceProvenance = z.infer<typeof contentIntelligenceProvenanceSchema>;

export function buildProvenanceMetadata(input: {
  briefId: string;
  creationMode: BriefCreationMode;
  brandId: string;
  campaignId?: string | null;
  sourceOpportunity?: { id: string; source: string; title?: string } | null;
  structuredBrief: ContentBrief;
  briefGeneration?: z.infer<typeof generationRecordSchema>;
  masterGeneration?: z.infer<typeof generationRecordSchema>;
  structuredMaster?: {
    title: string;
    summary?: string | null;
    hook?: string | null;
    body: string;
    keyPoints: string[];
    cta?: string | null;
    contentPillar?: string | null;
    recommendedChannels?: string[];
    riskFlags?: string[];
  };
  brandKnowledgeSnapshot?: {
    snapshotAt: string;
    usedRecords: UsedKnowledgeRecord[];
  };
  idempotency?: { briefKey?: string; masterKey?: string };
  originalBrief?: ContentBrief;
}): ContentIntelligenceProvenance {
  return {
    schemaVersion: CONTENT_INTELLIGENCE_PROVENANCE_SCHEMA_VERSION,
    briefId: input.briefId,
    creationMode: input.creationMode,
    generatedAt: new Date().toISOString(),
    brandId: input.brandId,
    campaignId: input.campaignId ?? null,
    sourceOpportunity: input.sourceOpportunity ?? null,
    structuredBrief: input.structuredBrief,
    originalBrief: input.originalBrief,
    briefGeneration: input.briefGeneration,
    masterGeneration: input.masterGeneration,
    structuredMaster: input.structuredMaster,
    brandKnowledgeSnapshot: input.brandKnowledgeSnapshot,
    idempotency: input.idempotency,
  };
}

export function parseContentIntelligenceProvenance(metadata: unknown): ContentIntelligenceProvenance | null {
  const parsed = contentIntelligenceProvenanceSchema.safeParse(metadata);
  if (!parsed.success) return null;
  return parsed.data;
}

export function provenanceToBrief(provenance: ContentIntelligenceProvenance): ContentBrief {
  return {
    ...provenance.structuredBrief,
    id: provenance.briefId,
  };
}
