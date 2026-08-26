import type { ContentObjective } from "@/lib/content-intelligence/types";

export type ContentTemplateDefinition = {
  id: string;
  name: string;
  description: string;
  studioType: string;
  objective: ContentObjective;
  structure: {
    sections: Array<{ key: string; label: string; guidance: string; required: boolean }>;
  };
  suggestedChannels: string[];
  suggestedFormats: string[];
};

export const CONTENT_TEMPLATES: ContentTemplateDefinition[] = [
  {
    id: "thought_leadership",
    name: "Thought leadership post",
    description: "Analytical perspective with a clear point of view.",
    studioType: "SOCIAL_POST",
    objective: "authority",
    structure: {
      sections: [
        { key: "hook", label: "Hook", guidance: "Lead with a contrarian or insight-led opening.", required: true },
        { key: "context", label: "Context", guidance: "Explain why this matters now.", required: true },
        { key: "insight", label: "Insight", guidance: "Share the core argument with evidence.", required: true },
        { key: "cta", label: "CTA", guidance: "Invite discussion or next step.", required: true },
      ],
    },
    suggestedChannels: ["LINKEDIN", "X"],
    suggestedFormats: ["text_post", "carousel"],
  },
  {
    id: "product_launch",
    name: "Product launch",
    description: "Announce a product or feature with clear value.",
    studioType: "SOCIAL_POST",
    objective: "product_adoption",
    structure: {
      sections: [
        { key: "announcement", label: "Announcement", guidance: "State what launched and for whom.", required: true },
        { key: "benefits", label: "Benefits", guidance: "3 concrete benefits.", required: true },
        { key: "proof", label: "Proof", guidance: "Customer or data proof if available.", required: false },
        { key: "cta", label: "CTA", guidance: "Drive trial, demo, or learn more.", required: true },
      ],
    },
    suggestedChannels: ["LINKEDIN", "X", "INSTAGRAM"],
    suggestedFormats: ["text_post", "carousel", "short_video"],
  },
  {
    id: "customer_proof",
    name: "Customer proof",
    description: "Showcase outcomes and social proof.",
    studioType: "CASE_STUDY",
    objective: "conversion",
    structure: {
      sections: [
        { key: "challenge", label: "Challenge", guidance: "Customer problem context.", required: true },
        { key: "solution", label: "Solution", guidance: "How your offer helped.", required: true },
        { key: "result", label: "Result", guidance: "Quantified outcome if available.", required: true },
        { key: "cta", label: "CTA", guidance: "Invite similar prospects to act.", required: true },
      ],
    },
    suggestedChannels: ["LINKEDIN", "INSTAGRAM"],
    suggestedFormats: ["carousel", "image_post"],
  },
  {
    id: "educational_carousel",
    name: "Educational carousel",
    description: "Step-by-step educational content.",
    studioType: "SOCIAL_POST",
    objective: "education",
    structure: {
      sections: [
        { key: "hook", label: "Hook", guidance: "Promise a clear learning outcome.", required: true },
        { key: "steps", label: "Steps", guidance: "3–7 actionable steps.", required: true },
        { key: "summary", label: "Summary", guidance: "Reinforce key takeaway.", required: true },
        { key: "cta", label: "CTA", guidance: "Save, share, or follow.", required: true },
      ],
    },
    suggestedChannels: ["LINKEDIN", "INSTAGRAM"],
    suggestedFormats: ["carousel"],
  },
  {
    id: "seo_article",
    name: "SEO article brief",
    description: "Long-form article aligned to search intent.",
    studioType: "SEO_CONTENT",
    objective: "traffic",
    structure: {
      sections: [
        { key: "intent", label: "Search intent", guidance: "Informational, commercial, or transactional.", required: true },
        { key: "outline", label: "Outline", guidance: "H2/H3 structure.", required: true },
        { key: "keywords", label: "Keywords", guidance: "Primary and secondary keywords if available.", required: false },
        { key: "cta", label: "CTA", guidance: "Conversion action within article.", required: true },
      ],
    },
    suggestedChannels: ["BLOG"],
    suggestedFormats: ["article"],
  },
];

export function getTemplateById(id: string): ContentTemplateDefinition | undefined {
  return CONTENT_TEMPLATES.find((template) => template.id === id);
}
