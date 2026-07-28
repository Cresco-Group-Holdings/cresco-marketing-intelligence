import { z } from "zod";
import { isValidSlug, normaliseSlug } from "@/lib/utils/slug";
import { isValidDomain, normaliseDomain } from "@/lib/utils/domain";
import { isValidHexColour } from "@/lib/utils/colors";

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

export const organisationCreateSchema = z.object({
  name: trimmedString(120),
  slug: z
    .string()
    .trim()
    .transform(normaliseSlug)
    .refine(isValidSlug, "Slug must be lowercase alphanumeric with hyphens."),
  legalName: optionalTrimmed(200),
  website: z.string().trim().url().optional().or(z.literal("")),
  industry: optionalTrimmed(120),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional()
    .or(z.literal("")),
  defaultTimezone: optionalTrimmed(80),
  createDefaultProject: z
    .object({
      name: trimmedString(120),
      slug: z.string().trim().transform(normaliseSlug).refine(isValidSlug),
    })
    .optional(),
});

export const organisationUpdateSchema = z.object({
  name: trimmedString(120).optional(),
  legalName: optionalTrimmed(200),
  website: z.string().trim().url().optional().or(z.literal("")),
  industry: optionalTrimmed(120),
  countryCode: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional()
    .or(z.literal("")),
  defaultTimezone: optionalTrimmed(80),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
});

export const projectCreateSchema = z.object({
  name: trimmedString(120),
  slug: z.string().trim().transform(normaliseSlug).refine(isValidSlug),
  description: optionalTrimmed(2000),
  website: z.string().trim().url().optional().or(z.literal("")),
});

export const projectUpdateSchema = z.object({
  name: trimmedString(120).optional(),
  slug: z.string().trim().transform(normaliseSlug).refine(isValidSlug).optional(),
  description: optionalTrimmed(2000),
  website: z.string().trim().url().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
});

export const brandCreateSchema = z.object({
  name: trimmedString(120),
  slug: z.string().trim().transform(normaliseSlug).refine(isValidSlug),
  description: optionalTrimmed(2000),
  website: z.string().trim().url().optional().or(z.literal("")),
  primaryDomain: z
    .string()
    .trim()
    .transform(normaliseDomain)
    .refine(isValidDomain, "Primary domain is invalid.")
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  faviconUrl: z.string().trim().url().optional().or(z.literal("")),
  primaryColour: z
    .string()
    .trim()
    .refine(isValidHexColour, "Primary colour must be a valid hex value.")
    .optional()
    .or(z.literal("")),
  secondaryColour: z
    .string()
    .trim()
    .refine(isValidHexColour, "Secondary colour must be a valid hex value.")
    .optional()
    .or(z.literal("")),
  accentColour: z
    .string()
    .trim()
    .refine(isValidHexColour, "Accent colour must be a valid hex value.")
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

export const brandUpdateSchema = brandCreateSchema.partial();

export const brandProfileUpdateSchema = z.object({
  shortDescription: optionalTrimmed(500),
  longDescription: optionalTrimmed(5000),
  mission: optionalTrimmed(2000),
  valueProposition: optionalTrimmed(2000),
  targetAudience: optionalTrimmed(2000),
  customerProblems: optionalTrimmed(2000),
  keyBenefits: optionalTrimmed(2000),
  productsAndServices: optionalTrimmed(5000),
  preferredTone: optionalTrimmed(1000),
  prohibitedTone: optionalTrimmed(1000),
  preferredLanguage: optionalTrimmed(40),
  targetCountries: z.array(z.string().trim().length(2)).max(50).optional(),
  targetIndustries: z.array(z.string().trim().max(120)).max(50).optional(),
  competitors: z.array(z.string().trim().max(120)).max(50).optional(),
  complianceNotes: optionalTrimmed(5000),
});

export const invitationCreateSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  role: z.enum(["OWNER", "ADMIN", "MARKETER", "ANALYST", "VIEWER"]).default("VIEWER"),
});

export const membershipRoleChangeSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MARKETER", "ANALYST", "VIEWER"]),
});

export const workspaceUpdateSchema = z.object({
  currentOrganisationId: z.string().cuid().optional().nullable(),
  currentProjectId: z.string().cuid().optional().nullable(),
  currentBrandId: z.string().cuid().optional().nullable(),
  onboardingStep: z.string().trim().max(80).optional().nullable(),
  completeOnboarding: z.boolean().optional(),
});

export const invitationAcceptSchema = z.object({
  token: z.string().trim().min(32).max(128),
});
