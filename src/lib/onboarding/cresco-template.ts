import { CRESCO_INTERNAL_TEMPLATE_KEY } from "@/lib/onboarding/constants";

export type CrescoTemplateProject = {
  name: string;
  slug: string;
  brandName: string;
  brandSlug: string;
  description?: string;
};

export type CrescoInternalTemplate = {
  key: typeof CRESCO_INTERNAL_TEMPLATE_KEY;
  label: string;
  description: string;
  organisation: {
    name: string;
    slug: string;
    industry: string;
    defaultTimezone: string;
  };
  projects: CrescoTemplateProject[];
};

export const CRESCO_INTERNAL_TEMPLATE: CrescoInternalTemplate = {
  key: CRESCO_INTERNAL_TEMPLATE_KEY,
  label: "Cresco internal workspace",
  description:
    "Pre-configured organisation, projects, and brands for the Cresco internal team. Only use when explicitly setting up Cresco Group.",
  organisation: {
    name: "Cresco Group",
    slug: "cresco-group",
    industry: "Marketing technology",
    defaultTimezone: "Europe/London",
  },
  projects: [
    {
      name: "Cresco Grants Intelligence",
      slug: "cresco-grants-intelligence",
      brandName: "Cresco Grants Intelligence",
      brandSlug: "cresco-grants-intelligence",
      description: "Grant discovery and intelligence for growth teams.",
    },
    {
      name: "Capital Cresco Terminal",
      slug: "capital-cresco-terminal",
      brandName: "Capital Cresco Terminal",
      brandSlug: "capital-cresco-terminal",
      description: "Capital markets intelligence terminal.",
    },
  ],
};

export function getOnboardingTemplate(key: string): CrescoInternalTemplate | null {
  if (key === CRESCO_INTERNAL_TEMPLATE_KEY) {
    return CRESCO_INTERNAL_TEMPLATE;
  }

  return null;
}
