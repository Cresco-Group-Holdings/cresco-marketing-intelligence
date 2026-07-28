import type { FoundationReadinessItem } from "@/lib/foundation/readiness";

export type FoundationNextAction = {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
};

export type FoundationNextActionInput = {
  readiness: FoundationReadinessItem[];
  hasBrand: boolean;
  brandId: string | null;
  onboardingCompleted: boolean;
  hasLogo: boolean;
  hasApprovedCta: boolean;
  aiProvidersConfigured: number;
  connectedConnectorCount: number;
  availableConnectorCount: number;
};

export function generateFoundationNextActions(
  input: FoundationNextActionInput,
): FoundationNextAction[] {
  const actions: FoundationNextAction[] = [];

  if (!input.onboardingCompleted) {
    actions.push({
      id: "complete-onboarding",
      title: "Complete onboarding",
      description: "Finish workspace setup to unlock the full foundation dashboard.",
      href: "/onboarding",
      priority: 1,
    });
  }

  const workspace = input.readiness.find((item) => item.category === "workspace");
  if (workspace?.status === "incomplete" || workspace?.status === "blocked") {
    actions.push({
      id: "complete-workspace",
      title: "Complete workspace setup",
      description: "Select an organisation, project, and brand to continue.",
      href: "/settings/organisation",
      priority: 2,
    });
  }

  if (!input.hasBrand) {
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }

  const brandBase = `/brands/${input.brandId}`;

  const audience = input.readiness.find((item) => item.category === "audience");
  if (audience?.status === "incomplete") {
    actions.push({
      id: "complete-audience",
      title: "Complete target audience",
      description: "Add audience segments and personas in Brand Knowledge.",
      href: `${brandBase}/knowledge`,
      priority: 10,
    });
  }

  const offer = input.readiness.find((item) => item.category === "offer");
  if (offer?.status === "incomplete") {
    actions.push({
      id: "add-offer",
      title: "Add product offer",
      description: "Document your primary product or service offer.",
      href: `${brandBase}/knowledge`,
      priority: 11,
    });
  }

  if (!input.hasLogo) {
    actions.push({
      id: "upload-logo",
      title: "Upload logo",
      description: "Add a brand logo to the asset library or brand profile.",
      href: `${brandBase}/assets`,
      priority: 12,
    });
  }

  if (!input.hasApprovedCta) {
    actions.push({
      id: "add-cta",
      title: "Add approved CTA",
      description: "Add call-to-action phrases to the messaging library.",
      href: `${brandBase}/knowledge`,
      priority: 13,
    });
  }

  const objectives = input.readiness.find((item) => item.category === "marketing_objectives");
  if (objectives?.status === "incomplete") {
    actions.push({
      id: "add-objective",
      title: "Add marketing objective",
      description: "Define what this brand is trying to achieve.",
      href: "/onboarding",
      priority: 14,
    });
  }

  if (input.aiProvidersConfigured === 0) {
    actions.push({
      id: "configure-ai",
      title: "Configure an AI provider",
      description: "Set server-side AI provider credentials for future agents.",
      href: "/settings/ai-diagnostics",
      priority: 15,
    });
  }

  const connectors = input.readiness.find((item) => item.category === "connectors");
  if (
    connectors?.status === "incomplete" &&
    input.availableConnectorCount > 0 &&
    input.connectedConnectorCount === 0
  ) {
    actions.push({
      id: "connect-data-source",
      title: "Connect first data source",
      description: "Link a marketing platform when connectors become available.",
      href: "/connectors",
      priority: 16,
    });
  }

  const brandProfile = input.readiness.find((item) => item.category === "brand_profile");
  if (brandProfile?.status === "incomplete") {
    actions.push({
      id: "complete-brand-profile",
      title: "Complete brand profile",
      description: "Fill in essential positioning and audience details.",
      href: `${brandBase}/profile`,
      priority: 17,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 8);
}
