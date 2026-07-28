import type { SocialAccountType, SocialCapability } from "@prisma/client";

const BASE_CAPABILITIES: Record<SocialAccountType, SocialCapability[]> = {
  INSTAGRAM_BUSINESS: [
    "PUBLISH_IMAGE",
    "PUBLISH_CAROUSEL",
    "PUBLISH_VIDEO",
    "PUBLISH_SHORT_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
    "READ_MESSAGES",
  ],
  FACEBOOK_PAGE: [
    "PUBLISH_TEXT",
    "PUBLISH_IMAGE",
    "PUBLISH_CAROUSEL",
    "PUBLISH_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
    "READ_MESSAGES",
    "WEBHOOK_SUPPORT",
  ],
  LINKEDIN_ORGANISATION: [
    "PUBLISH_TEXT",
    "PUBLISH_IMAGE",
    "PUBLISH_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
  ],
  LINKEDIN_MEMBER: ["PUBLISH_TEXT", "PUBLISH_IMAGE", "READ_INSIGHTS"],
  TIKTOK_BUSINESS: [
    "PUBLISH_VIDEO",
    "PUBLISH_SHORT_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
  ],
  YOUTUBE_CHANNEL: [
    "PUBLISH_VIDEO",
    "PUBLISH_SHORT_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
  ],
  X_ACCOUNT: [
    "PUBLISH_TEXT",
    "PUBLISH_IMAGE",
    "PUBLISH_VIDEO",
    "READ_INSIGHTS",
    "READ_COMMENTS",
    "MANAGE_COMMENTS",
    "READ_MESSAGES",
    "WEBHOOK_SUPPORT",
  ],
};

const SCOPE_CAPABILITY_MAP: Record<string, SocialCapability[]> = {
  "pages_manage_posts": ["PUBLISH_TEXT", "PUBLISH_IMAGE", "PUBLISH_CAROUSEL"],
  "pages_read_engagement": ["READ_INSIGHTS", "READ_COMMENTS"],
  "instagram_basic": ["READ_INSIGHTS"],
  "instagram_content_publish": ["PUBLISH_IMAGE", "PUBLISH_CAROUSEL", "PUBLISH_VIDEO"],
  "w_member_social": ["PUBLISH_TEXT", "PUBLISH_IMAGE"],
  "r_organization_social": ["READ_INSIGHTS", "READ_COMMENTS"],
  "video.upload": ["PUBLISH_VIDEO", "PUBLISH_SHORT_VIDEO"],
  "tweet.read": ["READ_INSIGHTS", "READ_COMMENTS"],
  "tweet.write": ["PUBLISH_TEXT", "PUBLISH_IMAGE"],
};

export function detectCapabilities(
  accountType: SocialAccountType,
  grantedScopes: string[],
): SocialCapability[] {
  const base = new Set(BASE_CAPABILITIES[accountType]);
  const granted = new Set<SocialCapability>();

  for (const scope of grantedScopes) {
    const mapped = SCOPE_CAPABILITY_MAP[scope];
    if (mapped) {
      for (const capability of mapped) {
        if (base.has(capability)) {
          granted.add(capability);
        }
      }
    }
  }

  if (granted.size === 0) {
    return [...base];
  }

  return Array.from(granted);
}

export function getMissingScopes(
  requiredScopes: string[],
  grantedScopes: string[],
): string[] {
  const grantedSet = new Set(grantedScopes);
  return requiredScopes.filter((scope) => !grantedSet.has(scope));
}

export const SOCIAL_CAPABILITY_LABELS: Record<SocialCapability, string> = {
  PUBLISH_TEXT: "Publish text",
  PUBLISH_IMAGE: "Publish image",
  PUBLISH_CAROUSEL: "Publish carousel",
  PUBLISH_VIDEO: "Publish video",
  PUBLISH_SHORT_VIDEO: "Publish short video",
  SCHEDULE_NATIVELY: "Schedule natively",
  READ_INSIGHTS: "Read insights",
  READ_COMMENTS: "Read comments",
  MANAGE_COMMENTS: "Manage comments",
  READ_MESSAGES: "Read messages",
  WEBHOOK_SUPPORT: "Webhook support",
};
