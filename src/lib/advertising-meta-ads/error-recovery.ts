export type MetaLaunchErrorKind =
  | "EXPIRED_TOKEN"
  | "PERMISSION_LOST"
  | "PAGE_ACCESS_LOST"
  | "INSTAGRAM_MISMATCH"
  | "POLICY_REJECTION"
  | "PARTIAL_MUTATION"
  | "TIMEOUT"
  | "DUPLICATE_RETRY"
  | "ACCOUNT_RESTRICTED"
  | "RATE_LIMIT"
  | "STALE_APPROVAL";

export function classifyMetaLaunchError(error: {
  code?: string | number;
  message?: string;
  policyRejected?: boolean;
  staleApproval?: boolean;
  duplicateResource?: boolean;
  partialMutation?: boolean;
}): {
  kind: MetaLaunchErrorKind;
  retryable: boolean;
  requiresReapproval: boolean;
  message: string;
  suggestedAction: string;
} {
  if (error.staleApproval) {
    return {
      kind: "STALE_APPROVAL",
      retryable: false,
      requiresReapproval: true,
      message: "Launch approval is stale after a material change.",
      suggestedAction: "Rebuild mutation plan and obtain fresh approvals.",
    };
  }
  if (error.duplicateResource) {
    return {
      kind: "DUPLICATE_RETRY",
      retryable: false,
      requiresReapproval: false,
      message: "Provider resources already exist for this idempotency key.",
      suggestedAction: "Sync existing provider state instead of re-creating.",
    };
  }
  if (error.policyRejected) {
    return {
      kind: "POLICY_REJECTION",
      retryable: false,
      requiresReapproval: true,
      message: "Meta policy rejected the ad.",
      suggestedAction: "Review policy findings and update creative/targeting.",
    };
  }

  const msg = (error.message ?? "").toUpperCase();
  const code = String(error.code ?? "");

  if (msg.includes("INSTAGRAM") || msg.includes("IG_ACCOUNT")) {
    return {
      kind: "INSTAGRAM_MISMATCH",
      retryable: false,
      requiresReapproval: true,
      message: "Instagram identity mismatch.",
      suggestedAction: "Re-select Instagram business account linked to the Page.",
    };
  }
  if (code === "190" || msg.includes("TOKEN")) {
    return { kind: "EXPIRED_TOKEN", retryable: false, requiresReapproval: false, message: "Access token expired.", suggestedAction: "Reconnect Meta Ads." };
  }
  if (code === "200" || msg.includes("PERMISSION")) {
    return { kind: "PERMISSION_LOST", retryable: false, requiresReapproval: true, message: "Permission lost.", suggestedAction: "Verify ads_management scope and asset access." };
  }
  if (msg.includes("PAGE")) {
    return { kind: "PAGE_ACCESS_LOST", retryable: false, requiresReapproval: true, message: "Page access lost.", suggestedAction: "Re-authorise Page permissions." };
  }
  if (code === "17" || code === "80004" || msg.includes("RATE")) {
    return { kind: "RATE_LIMIT", retryable: true, requiresReapproval: false, message: "Rate limit exceeded.", suggestedAction: "Backoff and retry." };
  }
  if (error.partialMutation) {
    return { kind: "PARTIAL_MUTATION", retryable: true, requiresReapproval: false, message: "Partial mutation completed.", suggestedAction: "Review created resources and retry failed steps." };
  }
  if (msg.includes("TIMEOUT")) {
    return { kind: "TIMEOUT", retryable: true, requiresReapproval: false, message: "Request timed out.", suggestedAction: "Verify provider state before retry." };
  }

  return {
    kind: "ACCOUNT_RESTRICTED",
    retryable: false,
    requiresReapproval: false,
    message: error.message ?? "Unknown Meta error.",
    suggestedAction: "Check ad account restrictions in Business Manager.",
  };
}
