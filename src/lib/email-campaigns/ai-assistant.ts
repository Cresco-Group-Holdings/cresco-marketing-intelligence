export type AiCampaignContext = {
  brandKnowledge?: string;
  product?: string;
  approvedClaims?: string[];
  audienceDescription?: string;
  campaignObjective?: string;
  language?: string;
  userInstructions?: string;
};

export type AiCampaignDraft = {
  subjectVariants: string[];
  preheaders: string[];
  emailDraft: string;
  ctaVariants: string[];
  summary: string;
  newsletterSections?: string[];
  provenance: Record<string, unknown>;
  requiresHumanApproval: true;
};

export function generateCampaignDraft(context: AiCampaignContext): AiCampaignDraft | null {
  if (!context.campaignObjective && !context.userInstructions) return null;

  const objective = context.campaignObjective ?? context.userInstructions ?? "Campaign update";
  const product = context.product ?? "our product";
  const audience = context.audienceDescription ?? "subscribers";

  return {
    subjectVariants: [
      `${objective} — update for ${audience}`,
      `What's new: ${objective}`,
    ],
    preheaders: [
      `A brief update on ${objective}.`,
      `Important information for ${audience}.`,
    ],
    emailDraft: [
      `Hi {{firstName}},`,
      "",
      objective,
      context.brandKnowledge ? `\n${context.brandKnowledge.slice(0, 200)}` : "",
      "",
      `Learn more about ${product}.`,
      "",
      "[Review before sending — do not invent testimonials or results.]",
    ].join("\n"),
    ctaVariants: ["Learn more", "Read the update", "Get started"],
    summary: `Draft for ${objective} targeting ${audience}.`,
    newsletterSections: context.campaignObjective?.includes("newsletter")
      ? ["Introduction", "Product update", "Resources", "Next steps"]
      : undefined,
    provenance: {
      objective: context.campaignObjective,
      product: context.product,
      approvedClaims: context.approvedClaims ?? [],
      audience: context.audienceDescription,
      language: context.language ?? "en",
      grounded: true,
      inventedTestimonials: false,
    },
    requiresHumanApproval: true,
  };
}
