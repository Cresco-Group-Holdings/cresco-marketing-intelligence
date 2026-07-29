import type { SocialProvider } from "@prisma/client";

export const PLATFORM_ADAPTATION_RULES_VERSION = "1.0.0";

export type PlatformAdaptationRule = {
  provider: SocialProvider;
  maxCaptionLength: number;
  maxHashtags: number;
  tone: "professional" | "conversational" | "energetic" | "authoritative";
  hashtagStyle: "inline" | "block" | "minimal";
  supportsLinksInCaption: boolean;
  hookMaxLength: number;
  preferredFormats: string[];
};

export const PLATFORM_ADAPTATION_RULES: PlatformAdaptationRule[] = [
  {
    provider: "LINKEDIN",
    maxCaptionLength: 3000,
    maxHashtags: 5,
    tone: "professional",
    hashtagStyle: "minimal",
    supportsLinksInCaption: true,
    hookMaxLength: 200,
    preferredFormats: ["TEXT_POST", "ARTICLE_LINK", "CAROUSEL"],
  },
  {
    provider: "INSTAGRAM",
    maxCaptionLength: 2200,
    maxHashtags: 20,
    tone: "energetic",
    hashtagStyle: "block",
    supportsLinksInCaption: false,
    hookMaxLength: 125,
    preferredFormats: ["IMAGE_POST", "CAROUSEL", "SHORT_VIDEO"],
  },
  {
    provider: "FACEBOOK",
    maxCaptionLength: 5000,
    maxHashtags: 10,
    tone: "conversational",
    hashtagStyle: "inline",
    supportsLinksInCaption: true,
    hookMaxLength: 150,
    preferredFormats: ["TEXT_POST", "IMAGE_POST", "ARTICLE_LINK"],
  },
  {
    provider: "X",
    maxCaptionLength: 280,
    maxHashtags: 3,
    tone: "conversational",
    hashtagStyle: "inline",
    supportsLinksInCaption: true,
    hookMaxLength: 100,
    preferredFormats: ["TEXT_POST", "THREAD"],
  },
  {
    provider: "TIKTOK",
    maxCaptionLength: 2200,
    maxHashtags: 8,
    tone: "energetic",
    hashtagStyle: "block",
    supportsLinksInCaption: false,
    hookMaxLength: 100,
    preferredFormats: ["SHORT_VIDEO"],
  },
  {
    provider: "YOUTUBE",
    maxCaptionLength: 5000,
    maxHashtags: 15,
    tone: "authoritative",
    hashtagStyle: "block",
    supportsLinksInCaption: true,
    hookMaxLength: 100,
    preferredFormats: ["LONG_VIDEO", "SHORT_VIDEO"],
  },
];

export function getPlatformRule(provider: SocialProvider): PlatformAdaptationRule {
  const rule = PLATFORM_ADAPTATION_RULES.find((item) => item.provider === provider);
  if (!rule) {
    throw new Error(`No adaptation rule for provider: ${provider}`);
  }
  return rule;
}

export function applyPlatformAdaptation(input: {
  provider: SocialProvider;
  caption: string;
  headline?: string;
  hashtags: string[];
  hook?: string;
  cta?: string;
}): {
  caption: string;
  headline?: string;
  hashtags: string[];
  hook?: string;
  cta?: string;
  validationErrors: string[];
} {
  const rule = getPlatformRule(input.provider);
  const validationErrors: string[] = [];

  let caption = input.caption.trim();
  let hook = input.hook?.trim();
  let hashtags = [...input.hashtags];

  if (caption.length > rule.maxCaptionLength) {
    caption = `${caption.slice(0, rule.maxCaptionLength - 1)}…`;
    validationErrors.push(
      `Caption trimmed to ${rule.maxCaptionLength} characters for ${input.provider}.`,
    );
  }

  if (hook && hook.length > rule.hookMaxLength) {
    hook = `${hook.slice(0, rule.hookMaxLength - 1)}…`;
    validationErrors.push(`Hook trimmed for ${input.provider}.`);
  }

  if (hashtags.length > rule.maxHashtags) {
    hashtags = hashtags.slice(0, rule.maxHashtags);
    validationErrors.push(`Hashtags limited to ${rule.maxHashtags} for ${input.provider}.`);
  }

  if (!rule.supportsLinksInCaption && /https?:\/\//i.test(caption)) {
    validationErrors.push(`${input.provider} captions should not include raw URLs.`);
  }

  if (rule.hashtagStyle === "block" && hashtags.length > 0) {
    const tagBlock = hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
    if (!caption.includes(tagBlock)) {
      caption = `${caption}\n\n${tagBlock}`.trim();
    }
  }

  return {
    caption,
    headline: input.headline,
    hashtags,
    hook,
    cta: input.cta,
    validationErrors,
  };
}
