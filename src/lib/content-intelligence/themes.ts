import type { ContentObjective } from "@/lib/content-intelligence/types";

export const DEFAULT_CONTENT_THEMES = [
  {
    key: "product_education",
    label: "Product education",
    description: "Explain product value, features, and use cases.",
    objective: "education" as ContentObjective,
    preferredChannels: ["LINKEDIN", "YOUTUBE"],
  },
  {
    key: "funding_opportunities",
    label: "Funding opportunities",
    description: "Grants, SEIS/EIS, and funding programme guidance.",
    objective: "lead_generation" as ContentObjective,
    preferredChannels: ["LINKEDIN", "X"],
  },
  {
    key: "founder_insights",
    label: "Founder insights",
    description: "Leadership perspective and company narrative.",
    objective: "authority" as ContentObjective,
    preferredChannels: ["LINKEDIN", "X"],
  },
  {
    key: "customer_proof",
    label: "Customer proof",
    description: "Case studies, testimonials, and outcomes.",
    objective: "conversion" as ContentObjective,
    preferredChannels: ["LINKEDIN", "INSTAGRAM"],
  },
  {
    key: "regulatory_analysis",
    label: "Regulatory analysis",
    description: "Compliance and regulatory updates for the audience.",
    objective: "education" as ContentObjective,
    preferredChannels: ["LINKEDIN"],
  },
  {
    key: "industry_trends",
    label: "Industry trends",
    description: "Market commentary and sector developments.",
    objective: "awareness" as ContentObjective,
    preferredChannels: ["LINKEDIN", "X"],
  },
  {
    key: "case_studies",
    label: "Case studies",
    description: "Detailed customer or project stories.",
    objective: "conversion" as ContentObjective,
    preferredChannels: ["LINKEDIN", "YOUTUBE"],
  },
  {
    key: "product_updates",
    label: "Product updates",
    description: "Release notes and feature announcements.",
    objective: "product_adoption" as ContentObjective,
    preferredChannels: ["LINKEDIN", "X", "INSTAGRAM"],
  },
  {
    key: "behind_the_scenes",
    label: "Behind the scenes",
    description: "Culture, team, and process content.",
    objective: "engagement" as ContentObjective,
    preferredChannels: ["INSTAGRAM", "TIKTOK"],
  },
] as const;

export type ContentThemeKey = (typeof DEFAULT_CONTENT_THEMES)[number]["key"];

export function resolveThemeLabel(key: string | null | undefined): string {
  if (!key) return "Unassigned";
  const match = DEFAULT_CONTENT_THEMES.find((theme) => theme.key === key);
  return match?.label ?? key.replace(/_/g, " ");
}
