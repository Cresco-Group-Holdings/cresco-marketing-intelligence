import { SocialProvider } from "@prisma/client";
import type { ControlledBrandContext } from "@/lib/ai/brand-context-builder";
import type { ContentIdeasOutput } from "@/lib/ai/content-output-schemas";

type IdeaSeed = {
  title: string;
  angle: string;
  suggestedPlatforms: SocialProvider[];
  contentPillar?: string;
};

const DEFAULT_PLATFORMS: SocialProvider[] = ["LINKEDIN", "INSTAGRAM", "FACEBOOK"];

function uniquePlatforms(platforms: SocialProvider[]): SocialProvider[] {
  return [...new Set(platforms)];
}

function buildObjectiveIdeas(context: ControlledBrandContext, pillar?: string): IdeaSeed[] {
  if (!context.objective) return [];
  return [
    {
      title: `Campaign spotlight: ${context.objective.type}`,
      angle: `Explain how ${context.brandName} supports the objective: ${context.objective.description}`,
      suggestedPlatforms: ["LINKEDIN", "FACEBOOK"],
      contentPillar: pillar,
    },
  ];
}

function buildAudienceIdeas(context: ControlledBrandContext, pillar?: string): IdeaSeed[] {
  if (!context.audience) return [];
  const pain = context.audience.painPoints[0];
  const motivation = context.audience.motivations[0];
  const ideas: IdeaSeed[] = [];
  if (pain) {
    ideas.push({
      title: `Solve ${pain.toLowerCase()}`,
      angle: `Address ${context.audience.name}'s pain point: ${pain}`,
      suggestedPlatforms: DEFAULT_PLATFORMS,
      contentPillar: pillar,
    });
  }
  if (motivation) {
    ideas.push({
      title: `Motivation moment for ${context.audience.name}`,
      angle: `Connect with what drives them: ${motivation}`,
      suggestedPlatforms: ["INSTAGRAM", "TIKTOK"],
      contentPillar: pillar,
    });
  }
  return ideas;
}

function buildOfferIdeas(context: ControlledBrandContext, pillar?: string): IdeaSeed[] {
  if (!context.offer) return [];
  const benefit = context.offer.benefits[0];
  return [
    {
      title: `Highlight ${context.offer.name}`,
      angle: benefit
        ? `Showcase the benefit: ${benefit}`
        : `Introduce ${context.offer.name} to your audience`,
      suggestedPlatforms: ["LINKEDIN", "INSTAGRAM", "YOUTUBE"],
      contentPillar: pillar,
    },
  ];
}

function buildMessagingIdeas(context: ControlledBrandContext, pillar?: string): IdeaSeed[] {
  const ideas: IdeaSeed[] = [];
  if (context.messaging?.coreMessage) {
    ideas.push({
      title: "Core message refresh",
      angle: `Reframe the core message: ${context.messaging.coreMessage}`,
      suggestedPlatforms: DEFAULT_PLATFORMS,
      contentPillar: pillar,
    });
  }
  for (const proposition of context.messaging?.valuePropositions.slice(0, 2) ?? []) {
    ideas.push({
      title: `Value proposition: ${proposition.slice(0, 60)}`,
      angle: `Turn this value proposition into a social post: ${proposition}`,
      suggestedPlatforms: ["LINKEDIN", "X"],
      contentPillar: pillar,
    });
  }
  return ideas;
}

function buildBriefIdea(brief: string, pillar?: string): IdeaSeed {
  return {
    title: brief.slice(0, 80),
    angle: brief,
    suggestedPlatforms: DEFAULT_PLATFORMS,
    contentPillar: pillar,
  };
}

export function generateRuleBasedIdeas(input: {
  context: ControlledBrandContext;
  brief?: string;
  contentPillar?: string;
  count: number;
}): ContentIdeasOutput["ideas"] {
  const seeds: IdeaSeed[] = [];

  if (input.brief?.trim()) {
    seeds.push(buildBriefIdea(input.brief.trim(), input.contentPillar));
  }

  seeds.push(
    ...buildObjectiveIdeas(input.context, input.contentPillar),
    ...buildAudienceIdeas(input.context, input.contentPillar),
    ...buildOfferIdeas(input.context, input.contentPillar),
    ...buildMessagingIdeas(input.context, input.contentPillar),
  );

  if (input.contentPillar) {
    seeds.push({
      title: `${input.contentPillar} pillar spotlight`,
      angle: `Create content aligned to the ${input.contentPillar} content pillar for ${input.context.brandName}.`,
      suggestedPlatforms: DEFAULT_PLATFORMS,
      contentPillar: input.contentPillar,
    });
  }

  if (seeds.length === 0) {
    seeds.push({
      title: `Introduce ${input.context.brandName}`,
      angle: `Share what ${input.context.brandName} does and who it helps.`,
      suggestedPlatforms: DEFAULT_PLATFORMS,
      contentPillar: input.contentPillar,
    });
  }

  const unique = new Map<string, IdeaSeed>();
  for (const seed of seeds) {
    if (!unique.has(seed.title)) unique.set(seed.title, seed);
  }

  return [...unique.values()].slice(0, input.count).map((seed) => ({
    ...seed,
    suggestedPlatforms: uniquePlatforms(seed.suggestedPlatforms),
  }));
}
