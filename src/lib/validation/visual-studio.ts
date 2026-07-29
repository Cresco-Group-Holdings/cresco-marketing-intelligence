import { VisualElementType, VisualExportFormat, VisualOutputType } from "@prisma/client";
import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const visualProjectCreateSchema = z.object({
  title: text(200),
  outputType: z.nativeEnum(VisualOutputType),
  templateId: z.string().optional(),
  sourceContentId: z.string().optional(),
  outline: z.array(text(1_000)).min(1).max(20),
  brandLocks: z
    .object({
      logoPosition: z.boolean().default(false),
      brandColours: z.boolean().default(true),
      requiredDisclaimer: optionalText(500),
      footer: optionalText(500),
      safeMargins: z.boolean().default(true),
    })
    .default({ brandColours: true, logoPosition: false, safeMargins: true }),
});

export const visualElementUpdateSchema = z.object({
  elementType: z.nativeEnum(VisualElementType).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  locked: z.boolean().optional(),
});

export const visualPageReorderSchema = z.object({
  pageIds: z.array(z.string()).min(1).max(20),
});

export const visualExportCreateSchema = z.object({
  format: z.nativeEnum(VisualExportFormat),
  attachToContentVariantId: z.string().optional(),
  altText: optionalText(1_000),
});

export const visualAiImageSchema = z.object({
  prompt: text(2_000),
  sourceAssetId: z.string().optional(),
  provider: z.enum(["MOCK"]).default("MOCK"),
  model: z.string().max(100).default("mock-image-v1"),
  commercialUseConfirmed: z.boolean(),
});

export type VisualProjectCreateInput = z.infer<typeof visualProjectCreateSchema>;
export type VisualExportCreateInput = z.infer<typeof visualExportCreateSchema>;
