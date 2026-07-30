import type { NormalisedProviderError } from "@/lib/advertising-providers/adapter-contract";

export function classifyTikTokLaunchError(error: unknown): NormalisedProviderError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (lower.includes("access_token") || lower.includes("expired") || lower.includes("401")) {
    return { code: "TOKEN_EXPIRED", message, recoverable: true, retryable: false, requiresReauth: true, requiresReapproval: false };
  }
  if (lower.includes("permission") || lower.includes("403")) {
    return { code: "PERMISSION_LOST", message, recoverable: true, retryable: false, requiresReauth: true, requiresReapproval: false };
  }
  if (lower.includes("policy") || lower.includes("rejected") || lower.includes("creative")) {
    return { code: "CREATIVE_REJECTED", message, recoverable: true, retryable: false, requiresReauth: false, requiresReapproval: true };
  }
  if (lower.includes("targeting") || lower.includes("invalid")) {
    return { code: "INVALID_TARGETING", message, recoverable: true, retryable: false, requiresReauth: false, requiresReapproval: true };
  }
  if (lower.includes("429") || lower.includes("rate")) {
    return { code: "RATE_LIMIT", message, recoverable: true, retryable: true, requiresReauth: false, requiresReapproval: false };
  }
  if (lower.includes("timeout")) {
    return { code: "TIMEOUT", message, recoverable: true, retryable: true, requiresReauth: false, requiresReapproval: false };
  }
  if (lower.includes("duplicate")) {
    return { code: "DUPLICATE", message, recoverable: true, retryable: false, requiresReauth: false, requiresReapproval: false };
  }
  if (lower.includes("suspended") || lower.includes("banned")) {
    return { code: "ACCOUNT_SUSPENDED", message, recoverable: false, retryable: false, requiresReauth: false, requiresReapproval: false };
  }
  if (lower.includes("objective") || lower.includes("unsupported")) {
    return { code: "UNSUPPORTED_OBJECTIVE", message, recoverable: false, retryable: false, requiresReauth: false, requiresReapproval: true };
  }

  return { code: "UNKNOWN", message, recoverable: false, retryable: false, requiresReauth: false, requiresReapproval: false };
}
