import { z } from "zod";

const knowledgeEntryTypeSchema = z.enum([
  "BRAND_GUIDELINE",
  "TONE_OF_VOICE",
  "PRODUCT",
  "SERVICE",
  "AUDIENCE",
  "PERSONA",
  "ICP",
  "COMPETITOR",
  "FAQ",
  "CASE_STUDY",
  "APPROVED_CLAIM",
  "PROHIBITED_CLAIM",
  "POLICY",
  "CAMPAIGN_CONTEXT",
  "SALES_MATERIAL",
  "GENERAL",
]);

const knowledgeEntryStatusSchema = z.enum([
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
]);

const knowledgeEntrySourceTypeSchema = z.enum([
  "MANUAL",
  "DOCUMENT",
  "URL",
  "IMPORT",
  "SYSTEM",
]);

const knowledgeRelationshipTypeSchema = z.enum([
  "RELATED",
  "CONFLICTS_WITH",
  "SUPERSEDES",
  "DERIVED_FROM",
]);

const optionalDateSchema = z
  .string()
  .datetime()
  .optional()
  .nullable()
  .transform((value) => (value ? new Date(value) : null));

export const knowledgeBaseCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

export const knowledgeBaseUpdateSchema = knowledgeBaseCreateSchema.partial();

export const knowledgeEntryCreateSchema = z.object({
  type: knowledgeEntryTypeSchema,
  title: z.string().trim().min(1).max(500),
  summary: z.string().trim().max(2000).optional(),
  content: z.string().min(1).max(200_000),
  sourceType: knowledgeEntrySourceTypeSchema.optional(),
  sourceReference: z.string().trim().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  validFrom: optionalDateSchema,
  validUntil: optionalDateSchema,
  campaignId: z.string().cuid().optional().nullable(),
  tagIds: z.array(z.string().cuid()).optional(),
});

export const knowledgeEntryUpdateSchema = knowledgeEntryCreateSchema
  .partial()
  .extend({
    expectedVersion: z.number().int().positive(),
    changeNote: z.string().trim().max(1000).optional(),
  });

export const knowledgeEntryListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: knowledgeEntryTypeSchema.optional(),
  status: knowledgeEntryStatusSchema.optional(),
  sourceType: knowledgeEntrySourceTypeSchema.optional(),
  campaignId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export const knowledgeEntryApprovalSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const knowledgeEntryRejectSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const knowledgeRelationshipCreateSchema = z.object({
  targetEntryId: z.string().cuid(),
  relationshipType: knowledgeRelationshipTypeSchema,
  note: z.string().trim().max(2000).optional(),
});

export const knowledgeTagCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colour: z.string().trim().max(20).optional(),
});

export const knowledgeRetrievalSchema = z.object({
  workspaceId: z.string().cuid().optional(),
  organisationId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  brandId: z.string().cuid().optional(),
  campaignId: z.string().cuid().optional(),
  query: z.string().trim().min(1).max(500),
  entryTypes: z.array(knowledgeEntryTypeSchema).optional(),
  approvedOnly: z.boolean().optional().default(true),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const knowledgeDocumentUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  entryId: z.string().cuid().optional().nullable(),
});

export type KnowledgeBaseCreateInput = z.infer<typeof knowledgeBaseCreateSchema>;
export type KnowledgeBaseUpdateInput = z.infer<typeof knowledgeBaseUpdateSchema>;
export type KnowledgeEntryCreateInput = z.infer<typeof knowledgeEntryCreateSchema>;
export type KnowledgeEntryUpdateInput = z.infer<typeof knowledgeEntryUpdateSchema>;
export type KnowledgeEntryListQuery = z.infer<typeof knowledgeEntryListQuerySchema>;
export type KnowledgeRelationshipCreateInput = z.infer<typeof knowledgeRelationshipCreateSchema>;
export type KnowledgeTagCreateInput = z.infer<typeof knowledgeTagCreateSchema>;
export type KnowledgeRetrievalInput = z.infer<typeof knowledgeRetrievalSchema>;
export type KnowledgeDocumentUpdateInput = z.infer<typeof knowledgeDocumentUpdateSchema>;
