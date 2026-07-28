import { z } from "zod";

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const stringArray = (maxItems: number, itemMax = 500) =>
  z.array(z.string().trim().min(1).max(itemMax)).max(maxItems).optional();

const ownershipFields = z
  .object({
    id: z.string().optional(),
    organisationId: z.string().optional(),
    projectId: z.string().optional(),
    brandId: z.string().optional(),
    createdAt: z.unknown().optional(),
    updatedAt: z.unknown().optional(),
    archivedAt: z.unknown().optional(),
  })
  .strip();

export const objectionResponseSchema = z.object({
  objection: trimmedString(500),
  response: trimmedString(2000),
});

export const brandAudienceCreateSchema = z.object({
  name: trimmedString(120),
  description: optionalTrimmed(2000),
  countries: z.array(z.string().trim().length(2)).max(50).optional(),
  industries: stringArray(50, 120),
  organisationType: optionalTrimmed(120),
  companySize: optionalTrimmed(80),
  jobRoles: stringArray(50, 120),
  painPoints: stringArray(50),
  motivations: stringArray(50),
  objections: stringArray(50),
  buyingTriggers: stringArray(50),
  preferredChannels: stringArray(50, 80),
});

export const brandAudienceUpdateSchema = brandAudienceCreateSchema.partial();

export const brandPersonaCreateSchema = z.object({
  name: trimmedString(120),
  description: optionalTrimmed(2000),
  roleTitle: optionalTrimmed(120),
  goals: stringArray(50),
  painPoints: stringArray(50),
  motivations: stringArray(50),
  objections: stringArray(50),
  buyingTriggers: stringArray(50),
  preferredChannels: stringArray(50, 80),
  notes: optionalTrimmed(2000),
});

export const brandPersonaUpdateSchema = brandPersonaCreateSchema.partial();

export const brandOfferCreateSchema = z.object({
  name: trimmedString(120),
  shortDescription: optionalTrimmed(1000),
  features: stringArray(50),
  benefits: stringArray(50),
  priceDescription: optionalTrimmed(500),
  trialAvailable: z.boolean().optional(),
  primaryCta: optionalTrimmed(120),
  landingPageUrl: z.string().trim().url().optional().or(z.literal("")),
  eligibilityRestrictions: optionalTrimmed(2000),
  availabilityStatus: z
    .enum(["AVAILABLE", "LIMITED", "COMING_SOON", "DISCONTINUED"])
    .optional(),
});

export const brandOfferUpdateSchema = brandOfferCreateSchema.partial();

export const brandMessageUpsertSchema = z.object({
  elevatorPitch: optionalTrimmed(1000),
  coreMessage: optionalTrimmed(2000),
  supportingMessages: stringArray(50),
  proofPoints: stringArray(50),
  differentiators: stringArray(50),
  objectionResponses: z.array(objectionResponseSchema).max(50).optional(),
  ctaLibrary: stringArray(50, 120),
  prohibitedClaims: stringArray(50),
});

export const brandVoiceRuleUpsertSchema = z.object({
  preferredTone: optionalTrimmed(500),
  vocabulary: stringArray(100, 80),
  prohibitedVocabulary: stringArray(100, 80),
  sentenceStyle: optionalTrimmed(500),
  emojiPolicy: optionalTrimmed(500),
  humourPolicy: optionalTrimmed(500),
  preferredSpelling: optionalTrimmed(80),
  languageVariants: stringArray(20, 40),
  approvedExamples: stringArray(20, 2000),
  unacceptableExamples: stringArray(20, 2000),
});

export const brandCompetitorCreateSchema = z.object({
  name: trimmedString(120),
  website: z.string().trim().url().optional().or(z.literal("")),
  description: optionalTrimmed(2000),
  strengths: stringArray(50),
  weaknesses: stringArray(50),
  positioning: optionalTrimmed(2000),
  notes: optionalTrimmed(2000),
});

export const brandCompetitorUpdateSchema = brandCompetitorCreateSchema.partial();

export const brandAssetCreateSchema = z.object({
  assetType: z.enum([
    "LOGO",
    "FAVICON",
    "COLOUR_PALETTE",
    "FONT",
    "SCREENSHOT",
    "PRODUCT_IMAGE",
    "PRESENTATION",
    "VIDEO_CLIP",
  ]),
  name: trimmedString(120),
  description: optionalTrimmed(2000),
  fileUrl: z.string().trim().url().optional().or(z.literal("")),
  mimeType: optionalTrimmed(120),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const brandAssetUpdateSchema = brandAssetCreateSchema.partial();

export const brandReferenceCreateSchema = z.object({
  referenceType: z
    .enum(["STYLE_GUIDE", "DOCUMENTATION", "EXTERNAL_LINK", "RESEARCH", "OTHER"])
    .optional(),
  title: trimmedString(200),
  url: z.string().trim().url().optional().or(z.literal("")),
  description: optionalTrimmed(2000),
  notes: optionalTrimmed(2000),
});

export const brandReferenceUpdateSchema = brandReferenceCreateSchema.partial();

export const brandComplianceRuleCreateSchema = z.object({
  ruleType: z.enum([
    "PROHIBITED_CLAIM",
    "REQUIRED_DISCLAIMER",
    "GRANT_ELIGIBILITY",
    "PRIVACY",
    "REGULATED_MARKET",
    "CONTENT_APPROVAL",
    "OTHER",
  ]),
  title: trimmedString(200),
  description: optionalTrimmed(2000),
  ruleText: trimmedString(5000),
  severity: z.enum(["INFO", "WARNING", "CRITICAL"]).optional(),
  appliesTo: stringArray(50, 80),
});

export const brandComplianceRuleUpdateSchema = brandComplianceRuleCreateSchema.partial();

const importAudienceSchema = brandAudienceCreateSchema.merge(ownershipFields);
const importPersonaSchema = brandPersonaCreateSchema.merge(ownershipFields);
const importOfferSchema = brandOfferCreateSchema.merge(ownershipFields);
const importCompetitorSchema = brandCompetitorCreateSchema.merge(ownershipFields);
const importAssetSchema = brandAssetCreateSchema.merge(ownershipFields);
const importReferenceSchema = brandReferenceCreateSchema.merge(ownershipFields);
const importComplianceSchema = brandComplianceRuleCreateSchema.merge(ownershipFields);

export const brandKnowledgeImportSchema = z.object({
  version: z.string().trim().min(1).max(20),
  exportedAt: z.string().optional(),
  audiences: z.array(importAudienceSchema).max(100).optional(),
  personas: z.array(importPersonaSchema).max(100).optional(),
  offers: z.array(importOfferSchema).max(100).optional(),
  messaging: brandMessageUpsertSchema.merge(ownershipFields).optional(),
  voice: brandVoiceRuleUpsertSchema.merge(ownershipFields).optional(),
  competitors: z.array(importCompetitorSchema).max(100).optional(),
  assets: z.array(importAssetSchema).max(200).optional(),
  references: z.array(importReferenceSchema).max(100).optional(),
  complianceRules: z.array(importComplianceSchema).max(100).optional(),
});

export type BrandAudienceCreateInput = z.infer<typeof brandAudienceCreateSchema>;
export type BrandPersonaCreateInput = z.infer<typeof brandPersonaCreateSchema>;
export type BrandOfferCreateInput = z.infer<typeof brandOfferCreateSchema>;
export type BrandMessageUpsertInput = z.infer<typeof brandMessageUpsertSchema>;
export type BrandVoiceRuleUpsertInput = z.infer<typeof brandVoiceRuleUpsertSchema>;
export type BrandCompetitorCreateInput = z.infer<typeof brandCompetitorCreateSchema>;
export type BrandAssetCreateInput = z.infer<typeof brandAssetCreateSchema>;
export type BrandReferenceCreateInput = z.infer<typeof brandReferenceCreateSchema>;
export type BrandComplianceRuleCreateInput = z.infer<typeof brandComplianceRuleCreateSchema>;
export type BrandKnowledgeImportInput = z.infer<typeof brandKnowledgeImportSchema>;
