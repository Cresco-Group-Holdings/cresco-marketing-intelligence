import { PROVIDER_ERROR_CODES, type ProviderErrorCode } from "@/lib/providers/errors";

export type UserFacingProviderError = {
  title: string;
  message: string;
  ctaLabel: string;
  ctaAction: "reconnect" | "review_permissions" | "retry" | "contact_support";
};

const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  meta: "Meta",
  "meta-ads": "Meta Ads",
  linkedin: "LinkedIn",
  "linkedin-ads": "LinkedIn Ads",
  "google-analytics": "Google Analytics 4",
  "google-search-console": "Google Search Console",
  youtube: "YouTube",
  x: "X",
  tiktok: "TikTok",
};

function providerLabel(providerKey: string): string {
  return PROVIDER_DISPLAY_NAMES[providerKey] ?? providerKey;
}

export function mapOAuthErrorToUserMessage(
  providerKey: string,
  rawError?: string | null,
): UserFacingProviderError {
  const label = providerLabel(providerKey);
  const normalized = (rawError ?? "").toLowerCase();

  if (normalized.includes("access_denied") || normalized.includes("denied")) {
    return {
      title: "Connection cancelled",
      message: `You declined access for ${label}. You can try again when ready.`,
      ctaLabel: `Connect ${label}`,
      ctaAction: "retry",
    };
  }

  if (normalized.includes("invalid_grant") || normalized.includes("expired")) {
    return {
      title: "Connection expired",
      message: `Your ${label} connection needs to be refreshed.`,
      ctaLabel: `Reconnect ${label}`,
      ctaAction: "reconnect",
    };
  }

  if (normalized.includes("insufficient_scope") || normalized.includes("permission")) {
    return {
      title: "Additional permissions required",
      message: `This ${label} connection does not have permission for the requested action.`,
      ctaLabel: "Review permissions",
      ctaAction: "review_permissions",
    };
  }

  if (normalized.includes("rate limit") || normalized.includes("429")) {
    return {
      title: "Provider temporarily busy",
      message: `${label} is rate limiting requests. Please try again shortly.`,
      ctaLabel: "Retry",
      ctaAction: "retry",
    };
  }

  return {
    title: "Connection failed",
    message: `We couldn't complete the ${label} connection. Your existing data has been preserved.`,
    ctaLabel: `Reconnect ${label}`,
    ctaAction: "reconnect",
  };
}

export function mapProviderErrorCodeToUserMessage(
  providerKey: string,
  code: ProviderErrorCode,
): UserFacingProviderError {
  const label = providerLabel(providerKey);

  switch (code) {
    case PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED:
    case PROVIDER_ERROR_CODES.PROVIDER_CONNECTION_EXPIRED:
      return {
        title: "Reauthentication required",
        message: `Your ${label} connection needs to be refreshed.`,
        ctaLabel: `Reconnect ${label}`,
        ctaAction: "reconnect",
      };
    case PROVIDER_ERROR_CODES.PROVIDER_PERMISSION_DENIED:
      return {
        title: "Permission denied",
        message: `This ${label} connection does not have permission to publish.`,
        ctaLabel: "Review permissions",
        ctaAction: "review_permissions",
      };
    case PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED:
      return {
        title: "Rate limited",
        message: `${label} is temporarily limiting requests. Sync will retry automatically.`,
        ctaLabel: "Retry",
        ctaAction: "retry",
      };
    case PROVIDER_ERROR_CODES.PROVIDER_TIMEOUT:
    case PROVIDER_ERROR_CODES.PROVIDER_UNAVAILABLE:
      return {
        title: "Provider unavailable",
        message: `${label} is temporarily unavailable. We'll retry automatically.`,
        ctaLabel: "Retry",
        ctaAction: "retry",
      };
    default:
      return mapOAuthErrorToUserMessage(providerKey);
  }
}
