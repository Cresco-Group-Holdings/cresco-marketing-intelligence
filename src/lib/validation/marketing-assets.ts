import { z } from "zod";

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const stringArray = (maxItems: number, itemMax = 80) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(maxItems).optional();

export const marketingAssetListQuerySchema = z.object({
  status: z.enum(["PROCESSING", "READY", "REJECTED", "ARCHIVED"]).optional(),
  assetType: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]).optional(),
  tag: z.string().trim().max(80).optional(),
  approvedForMarketing: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  view: z.enum(["grid", "list"]).optional(),
});

export const marketingAssetUpdateSchema = z.object({
  title: trimmedString(200).optional(),
  description: optionalTrimmed(2000),
  tags: stringArray(50),
  approvedForMarketing: z.boolean().optional(),
  approvedPlatforms: stringArray(50),
  licenceOwner: optionalTrimmed(200),
  licenceNotes: optionalTrimmed(2000),
  licenceExpiresAt: z.string().datetime().optional().nullable(),
  attributionRequired: z.boolean().optional(),
  consentNotes: optionalTrimmed(2000),
});

export type MarketingAssetUpdateInput = z.infer<typeof marketingAssetUpdateSchema>;
export type MarketingAssetListQuery = z.infer<typeof marketingAssetListQuerySchema>;
