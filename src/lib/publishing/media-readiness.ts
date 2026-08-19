import type { MarketingAsset } from "@prisma/client";

export type MediaReadinessIssue = {
  code: string;
  message: string;
  assetId?: string;
};

export type MediaReadinessResult = {
  ready: boolean;
  mediaUrls: string[];
  mediaType: "IMAGE" | "CAROUSEL" | "REELS" | null;
  issues: MediaReadinessIssue[];
};

const BLOCKED_URL_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\.0\.0\.1/i,
  /^https?:\/\/0\.0\.0\.0/i,
  /^https?:\/\/\[::1\]/i,
  /^file:/i,
];

export function isProviderAccessibleUrl(url: string): boolean {
  if (!url.startsWith("https://")) return false;
  return !BLOCKED_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function classifyInstagramMediaType(
  assets: Array<Pick<MarketingAsset, "assetType">>,
): "IMAGE" | "CAROUSEL" | "REELS" | null {
  if (assets.length === 0) return null;
  if (assets.some((asset) => asset.assetType === "VIDEO")) return "REELS";
  if (assets.length > 1) return "CAROUSEL";
  if (assets.length === 1 && assets[0]?.assetType === "IMAGE") return "IMAGE";
  return null;
}

export function evaluateMediaReadiness(input: {
  assets: Array<
    Pick<
      MarketingAsset,
      "id" | "status" | "approvedForMarketing" | "assetType" | "licenceExpiresAt" | "mimeType"
    >
  >;
  signedUrls?: string[];
  now?: Date;
}): MediaReadinessResult {
  const now = input.now ?? new Date();
  const issues: MediaReadinessIssue[] = [];
  const readyAssets = input.assets.filter(
    (asset) =>
      asset.status === "READY" &&
      asset.approvedForMarketing &&
      (!asset.licenceExpiresAt || asset.licenceExpiresAt > now),
  );

  if (readyAssets.length === 0) {
    issues.push({
      code: "NO_READY_MEDIA",
      message: "At least one approved, ready marketing asset is required.",
    });
  }

  for (const asset of input.assets) {
    if (asset.status !== "READY") {
      issues.push({
        code: "ASSET_NOT_READY",
        message: "One or more assets are still processing.",
        assetId: asset.id,
      });
    }
    if (!asset.approvedForMarketing) {
      issues.push({
        code: "ASSET_NOT_APPROVED",
        message: "All media must be approved for marketing before publishing.",
        assetId: asset.id,
      });
    }
    if (asset.licenceExpiresAt && asset.licenceExpiresAt <= now) {
      issues.push({
        code: "ASSET_LICENCE_EXPIRED",
        message: "A media licence has expired.",
        assetId: asset.id,
      });
    }
    if (asset.mimeType && !asset.mimeType.startsWith("image/") && !asset.mimeType.startsWith("video/")) {
      issues.push({
        code: "UNSUPPORTED_MIME",
        message: `Unsupported media type: ${asset.mimeType}.`,
        assetId: asset.id,
      });
    }
  }

  const mediaType = classifyInstagramMediaType(readyAssets);
  if (readyAssets.length > 0 && !mediaType) {
    issues.push({
      code: "UNSUPPORTED_MEDIA_COMBINATION",
      message: "Instagram publishing supports single image, carousel (2–10 images), or video/reel.",
    });
  }

  if (readyAssets.length > 10) {
    issues.push({
      code: "CAROUSEL_LIMIT",
      message: "Instagram carousels support a maximum of 10 images.",
    });
  }

  const mediaUrls = input.signedUrls ?? [];
  for (const url of mediaUrls) {
    if (!isProviderAccessibleUrl(url)) {
      issues.push({
        code: "MEDIA_URL_NOT_PUBLIC",
        message: "Media must be reachable over HTTPS from Meta servers (not localhost/private).",
      });
    }
  }

  return {
    ready: issues.length === 0 && readyAssets.length > 0 && mediaType !== null,
    mediaUrls,
    mediaType,
    issues,
  };
}
