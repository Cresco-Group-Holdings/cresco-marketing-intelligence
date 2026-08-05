import { z } from "zod";

const digitalAssetTypeSchema = z.enum([
  "IMAGE",
  "VIDEO",
  "AUDIO",
  "DOCUMENT",
  "LOGO",
  "TEMPLATE",
  "AD_CREATIVE",
  "SOCIAL_CREATIVE",
  "OTHER",
]);

const digitalAssetStatusSchema = z.enum([
  "UPLOADING",
  "PROCESSING",
  "READY",
  "FAILED",
  "ARCHIVED",
]);

const digitalAssetUsageEntityTypeSchema = z.enum([
  "CAMPAIGN",
  "CONTENT_ITEM",
  "ADVERTISEMENT",
  "KNOWLEDGE_ENTRY",
  "BRAND",
]);

export const digitalAssetListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  type: digitalAssetTypeSchema.optional(),
  status: digitalAssetStatusSchema.optional(),
  campaignId: z.string().cuid().optional(),
  tagId: z.string().cuid().optional(),
  collectionId: z.string().cuid().optional(),
  includeArchived: z.coerce.boolean().optional(),
});

export const digitalAssetUpdateSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  campaignId: z.string().cuid().optional().nullable(),
  type: digitalAssetTypeSchema.optional(),
});

export const digitalAssetTagCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  colour: z.string().trim().max(20).optional(),
});

export const digitalAssetCollectionCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

export const digitalAssetUsageCreateSchema = z.object({
  entityType: digitalAssetUsageEntityTypeSchema,
  entityId: z.string().min(1).max(200),
  usageRole: z.string().trim().max(200).optional(),
});

export const digitalAssetBulkArchiveSchema = z.object({
  assetIds: z.array(z.string().cuid()).min(1).max(100),
});

export type DigitalAssetListQuery = z.infer<typeof digitalAssetListQuerySchema>;
export type DigitalAssetUpdateInput = z.infer<typeof digitalAssetUpdateSchema>;
export type DigitalAssetTagCreateInput = z.infer<typeof digitalAssetTagCreateSchema>;
export type DigitalAssetCollectionCreateInput = z.infer<typeof digitalAssetCollectionCreateSchema>;
export type DigitalAssetUsageCreateInput = z.infer<typeof digitalAssetUsageCreateSchema>;
export type DigitalAssetBulkArchiveInput = z.infer<typeof digitalAssetBulkArchiveSchema>;
