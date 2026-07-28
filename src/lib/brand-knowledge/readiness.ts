import type {
  Brand,
  BrandAsset,
  BrandAudience,
  BrandComplianceRule,
  BrandCompetitor,
  BrandMessage,
  BrandOffer,
  BrandPersona,
  BrandProfile,
  BrandReference,
  BrandVoiceRule,
} from "@prisma/client";

export type KnowledgeReadinessCategory =
  | "identity"
  | "audience"
  | "offer"
  | "messaging"
  | "voice"
  | "compliance"
  | "assets";

export type KnowledgeReadinessField = {
  field: string;
  label: string;
  recommended: boolean;
};

export type KnowledgeReadinessCategoryResult = {
  category: KnowledgeReadinessCategory;
  label: string;
  score: number;
  filled: number;
  total: number;
  missing: KnowledgeReadinessField[];
  recommended: KnowledgeReadinessField[];
};

export type KnowledgeReadinessResult = {
  overallScore: number;
  categories: KnowledgeReadinessCategoryResult[];
  summary: string;
};

export type BrandKnowledgeSnapshot = {
  brand: Pick<
    Brand,
    | "name"
    | "description"
    | "website"
    | "primaryDomain"
    | "logoUrl"
    | "faviconUrl"
    | "primaryColour"
    | "secondaryColour"
    | "accentColour"
  >;
  profile: BrandProfile | null;
  audiences: BrandAudience[];
  personas: BrandPersona[];
  offers: BrandOffer[];
  messaging: BrandMessage | null;
  voice: BrandVoiceRule | null;
  competitors: BrandCompetitor[];
  assets: BrandAsset[];
  references: BrandReference[];
  complianceRules: BrandComplianceRule[];
};

type FieldCheck = {
  field: string;
  label: string;
  recommended?: boolean;
  filled: boolean;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasItems(values: string[] | null | undefined): boolean {
  return Array.isArray(values) && values.some((value) => value.trim().length > 0);
}

function scoreCategory(checks: FieldCheck[]): Omit<KnowledgeReadinessCategoryResult, "category" | "label"> {
  const total = checks.length;
  const filled = checks.filter((check) => check.filled).length;
  const missing = checks
    .filter((check) => !check.filled)
    .map(({ field, label, recommended }) => ({ field, label, recommended: recommended ?? false }));
  const recommended = missing.filter((field) => field.recommended);

  return {
    score: total === 0 ? 100 : Math.round((filled / total) * 100),
    filled,
    total,
    missing: missing.map(({ field, label, recommended }) => ({ field, label, recommended })),
    recommended,
  };
}

function evaluateIdentity(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const { brand, profile } = snapshot;
  const checks: FieldCheck[] = [
    { field: "brand.name", label: "Brand name", filled: hasText(brand.name) },
    { field: "brand.description", label: "Brand description", recommended: true, filled: hasText(brand.description) },
    { field: "brand.website", label: "Brand website", recommended: true, filled: hasText(brand.website) },
    { field: "brand.primaryDomain", label: "Primary domain", filled: hasText(brand.primaryDomain) },
    { field: "brand.logoUrl", label: "Logo URL", recommended: true, filled: hasText(brand.logoUrl) },
    { field: "profile.shortDescription", label: "Short description", recommended: true, filled: hasText(profile?.shortDescription) },
    { field: "profile.longDescription", label: "Long description", filled: hasText(profile?.longDescription) },
    { field: "profile.mission", label: "Mission", filled: hasText(profile?.mission) },
    { field: "profile.valueProposition", label: "Value proposition", recommended: true, filled: hasText(profile?.valueProposition) },
  ];

  return {
    category: "identity",
    label: "Identity",
    ...scoreCategory(checks),
  };
}

function evaluateAudience(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const activeAudiences = snapshot.audiences.filter((item) => !item.archivedAt);
  const activePersonas = snapshot.personas.filter((item) => !item.archivedAt);

  const audienceChecks: FieldCheck[] =
    activeAudiences.length === 0
      ? [
          {
            field: "audiences",
            label: "At least one audience segment",
            recommended: true,
            filled: false,
          },
        ]
      : activeAudiences.flatMap((audience, index) => [
          {
            field: `audiences[${index}].name`,
            label: `Audience ${index + 1}: name`,
            filled: hasText(audience.name),
          },
          {
            field: `audiences[${index}].description`,
            label: `Audience ${index + 1}: description`,
            recommended: true,
            filled: hasText(audience.description),
          },
          {
            field: `audiences[${index}].countries`,
            label: `Audience ${index + 1}: countries`,
            recommended: true,
            filled: hasItems(audience.countries),
          },
          {
            field: `audiences[${index}].painPoints`,
            label: `Audience ${index + 1}: pain points`,
            recommended: true,
            filled: hasItems(audience.painPoints),
          },
        ]);

  const personaChecks: FieldCheck[] =
    activePersonas.length === 0
      ? [
          {
            field: "personas",
            label: "At least one persona",
            recommended: true,
            filled: false,
          },
        ]
      : activePersonas.map((persona, index) => ({
          field: `personas[${index}].name`,
          label: `Persona ${index + 1}: name`,
          filled: hasText(persona.name),
        }));

  return {
    category: "audience",
    label: "Audience",
    ...scoreCategory([...audienceChecks, ...personaChecks]),
  };
}

function evaluateOffer(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const activeOffers = snapshot.offers.filter((item) => !item.archivedAt);

  const checks: FieldCheck[] =
    activeOffers.length === 0
      ? [
          {
            field: "offers",
            label: "At least one offer",
            recommended: true,
            filled: false,
          },
        ]
      : activeOffers.flatMap((offer, index) => [
          {
            field: `offers[${index}].name`,
            label: `Offer ${index + 1}: name`,
            filled: hasText(offer.name),
          },
          {
            field: `offers[${index}].shortDescription`,
            label: `Offer ${index + 1}: description`,
            recommended: true,
            filled: hasText(offer.shortDescription),
          },
          {
            field: `offers[${index}].benefits`,
            label: `Offer ${index + 1}: benefits`,
            recommended: true,
            filled: hasItems(offer.benefits),
          },
          {
            field: `offers[${index}].primaryCta`,
            label: `Offer ${index + 1}: primary CTA`,
            filled: hasText(offer.primaryCta),
          },
        ]);

  return {
    category: "offer",
    label: "Offer",
    ...scoreCategory(checks),
  };
}

function evaluateMessaging(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const messaging = snapshot.messaging;
  const checks: FieldCheck[] = [
    {
      field: "messaging.elevatorPitch",
      label: "Elevator pitch",
      recommended: true,
      filled: hasText(messaging?.elevatorPitch),
    },
    {
      field: "messaging.coreMessage",
      label: "Core message",
      recommended: true,
      filled: hasText(messaging?.coreMessage),
    },
    {
      field: "messaging.supportingMessages",
      label: "Supporting messages",
      filled: hasItems(messaging?.supportingMessages),
    },
    {
      field: "messaging.proofPoints",
      label: "Proof points",
      recommended: true,
      filled: hasItems(messaging?.proofPoints),
    },
    {
      field: "messaging.differentiators",
      label: "Differentiators",
      recommended: true,
      filled: hasItems(messaging?.differentiators),
    },
    {
      field: "messaging.ctaLibrary",
      label: "CTA library",
      filled: hasItems(messaging?.ctaLibrary),
    },
    {
      field: "messaging.prohibitedClaims",
      label: "Prohibited claims",
      filled: hasItems(messaging?.prohibitedClaims),
    },
  ];

  return {
    category: "messaging",
    label: "Messaging",
    ...scoreCategory(checks),
  };
}

function evaluateVoice(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const voice = snapshot.voice;
  const checks: FieldCheck[] = [
    {
      field: "voice.preferredTone",
      label: "Preferred tone",
      recommended: true,
      filled: hasText(voice?.preferredTone),
    },
    {
      field: "voice.vocabulary",
      label: "Preferred vocabulary",
      filled: hasItems(voice?.vocabulary),
    },
    {
      field: "voice.prohibitedVocabulary",
      label: "Prohibited vocabulary",
      filled: hasItems(voice?.prohibitedVocabulary),
    },
    {
      field: "voice.sentenceStyle",
      label: "Sentence style",
      filled: hasText(voice?.sentenceStyle),
    },
    {
      field: "voice.emojiPolicy",
      label: "Emoji policy",
      filled: hasText(voice?.emojiPolicy),
    },
    {
      field: "voice.approvedExamples",
      label: "Approved writing examples",
      recommended: true,
      filled: hasItems(voice?.approvedExamples),
    },
  ];

  return {
    category: "voice",
    label: "Voice",
    ...scoreCategory(checks),
  };
}

function evaluateCompliance(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const activeRules = snapshot.complianceRules.filter((item) => !item.archivedAt);
  const checks: FieldCheck[] =
    activeRules.length === 0
      ? [
          {
            field: "complianceRules",
            label: "At least one compliance rule",
            recommended: true,
            filled: false,
          },
          {
            field: "profile.complianceNotes",
            label: "Profile compliance notes",
            filled: hasText(snapshot.profile?.complianceNotes),
          },
        ]
      : [
          ...activeRules.map((rule, index) => ({
            field: `complianceRules[${index}].title`,
            label: `Rule ${index + 1}: title`,
            filled: hasText(rule.title),
          })),
          ...activeRules.map((rule, index) => ({
            field: `complianceRules[${index}].ruleText`,
            label: `Rule ${index + 1}: rule text`,
            recommended: true,
            filled: hasText(rule.ruleText),
          })),
        ];

  return {
    category: "compliance",
    label: "Compliance",
    ...scoreCategory(checks),
  };
}

function evaluateAssets(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessCategoryResult {
  const activeAssets = snapshot.assets.filter((item) => !item.archivedAt);
  const checks: FieldCheck[] = [
    {
      field: "brand.logoUrl",
      label: "Brand logo",
      recommended: true,
      filled: hasText(snapshot.brand.logoUrl),
    },
    {
      field: "brand.faviconUrl",
      label: "Favicon",
      filled: hasText(snapshot.brand.faviconUrl),
    },
    {
      field: "brand.primaryColour",
      label: "Primary colour",
      recommended: true,
      filled: hasText(snapshot.brand.primaryColour),
    },
    {
      field: "assets",
      label: "At least one brand asset record",
      recommended: true,
      filled: activeAssets.length > 0,
    },
    {
      field: "assets.logo",
      label: "Logo asset metadata",
      filled: activeAssets.some((asset) => asset.assetType === "LOGO"),
    },
    {
      field: "assets.colourPalette",
      label: "Colour palette asset metadata",
      filled: activeAssets.some((asset) => asset.assetType === "COLOUR_PALETTE"),
    },
  ];

  return {
    category: "assets",
    label: "Assets",
    ...scoreCategory(checks),
  };
}

export function calculateKnowledgeReadiness(snapshot: BrandKnowledgeSnapshot): KnowledgeReadinessResult {
  const categories = [
    evaluateIdentity(snapshot),
    evaluateAudience(snapshot),
    evaluateOffer(snapshot),
    evaluateMessaging(snapshot),
    evaluateVoice(snapshot),
    evaluateCompliance(snapshot),
    evaluateAssets(snapshot),
  ];

  const overallScore = Math.round(
    categories.reduce((sum, category) => sum + category.score, 0) / categories.length,
  );

  const incompleteCategories = categories.filter((category) => category.score < 100);
  const summary =
    incompleteCategories.length === 0
      ? "Brand knowledge base is complete across all categories."
      : `${incompleteCategories.length} categor${incompleteCategories.length === 1 ? "y" : "ies"} need attention: ${incompleteCategories.map((category) => category.label).join(", ")}.`;

  return {
    overallScore,
    categories,
    summary,
  };
}

export function buildKnowledgeSummary(snapshot: BrandKnowledgeSnapshot, readiness: KnowledgeReadinessResult): string {
  const lines = [
    `Brand: ${snapshot.brand.name}`,
    `Readiness: ${readiness.overallScore}%`,
    "",
    "Categories:",
    ...readiness.categories.map(
      (category) =>
        `- ${category.label}: ${category.score}% (${category.filled}/${category.total} fields)`,
    ),
    "",
    "Counts:",
    `- Audiences: ${snapshot.audiences.filter((item) => !item.archivedAt).length}`,
    `- Personas: ${snapshot.personas.filter((item) => !item.archivedAt).length}`,
    `- Offers: ${snapshot.offers.filter((item) => !item.archivedAt).length}`,
    `- Competitors: ${snapshot.competitors.filter((item) => !item.archivedAt).length}`,
    `- Assets: ${snapshot.assets.filter((item) => !item.archivedAt).length}`,
    `- Compliance rules: ${snapshot.complianceRules.filter((item) => !item.archivedAt).length}`,
  ];

  const recommended = readiness.categories.flatMap((category) =>
    category.recommended.map((field) => `- ${category.label}: ${field.label}`),
  );

  if (recommended.length > 0) {
    lines.push("", "Recommended next fields:", ...recommended.slice(0, 12));
  }

  return lines.join("\n");
}
