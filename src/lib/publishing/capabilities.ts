import type { ContentType, SocialCapability } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { SOCIAL_CAPABILITY_LABELS } from "@/lib/social/capabilities";

/** Maps a content variant format to the publish capability the account must hold. */
export function capabilityForContentFormat(format: ContentType): SocialCapability | null {
  switch (format) {
    case "TEXT_POST":
    case "ARTICLE_LINK":
    case "POLL":
    case "THREAD":
      return "PUBLISH_TEXT";
    case "IMAGE_POST":
    case "STORY":
      return "PUBLISH_IMAGE";
    case "CAROUSEL":
      return "PUBLISH_CAROUSEL";
    case "SHORT_VIDEO":
      return "PUBLISH_SHORT_VIDEO";
    case "LONG_VIDEO":
      return "PUBLISH_VIDEO";
    default:
      return null;
  }
}

/**
 * Ensures the connected account has been granted the capability required for the variant format.
 * Callers that already loaded capabilities can pass them to avoid an extra query.
 */
export async function assertAccountPublishingCapability(
  socialAccountId: string,
  format: ContentType,
  grantedCapabilities?: SocialCapability[],
): Promise<void> {
  const required = capabilityForContentFormat(format);
  if (!required) return;

  const capabilities =
    grantedCapabilities ??
    (
      await prisma.socialAccountCapability.findMany({
        where: { socialAccountId },
        select: { capability: true },
      })
    ).map((row) => row.capability);

  if (!capabilities.includes(required)) {
    throw new AppError(
      "FORBIDDEN",
      `The connected account does not have the ${SOCIAL_CAPABILITY_LABELS[required]} capability.`,
    );
  }
}

export function accountHasPublishingCapability(
  format: ContentType,
  grantedCapabilities: SocialCapability[],
): boolean {
  const required = capabilityForContentFormat(format);
  if (!required) return true;
  return grantedCapabilities.includes(required);
}
