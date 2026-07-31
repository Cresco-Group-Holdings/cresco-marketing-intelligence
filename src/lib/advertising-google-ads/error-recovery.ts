export type LaunchErrorKind =
  | "PARTIAL_FAILURE"
  | "TIMEOUT_AFTER_MUTATION"
  | "DUPLICATE_RETRY"
  | "PERMISSION_LOST"
  | "ACCOUNT_SUSPENDED"
  | "POLICY_REJECTION"
  | "QUOTA_EXHAUSTED"
  | "STALE_APPROVAL"
  | "STATE_MISMATCH";

export type RecoveryAction = {
  kind: LaunchErrorKind;
  retryable: boolean;
  requiresReapproval: boolean;
  message: string;
  suggestedAction: string;
};

export function classifyLaunchError(error: {
  code?: string;
  status?: number;
  message?: string;
  partialFailure?: boolean;
  staleApproval?: boolean;
  duplicateResource?: boolean;
}): RecoveryAction {
  if (error.staleApproval) {
    return {
      kind: "STALE_APPROVAL",
      retryable: false,
      requiresReapproval: true,
      message: "Launch approval is stale after a material plan change.",
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

  if (error.partialFailure) {
    return {
      kind: "PARTIAL_FAILURE",
      retryable: true,
      requiresReapproval: false,
      message: "Some operations succeeded while others failed.",
      suggestedAction: "Review partial failure details and retry failed operations only.",
    };
  }

  const code = (error.code ?? error.message ?? "").toUpperCase();

  if (code.includes("TIMEOUT") || error.status === 504) {
    return {
      kind: "TIMEOUT_AFTER_MUTATION",
      retryable: true,
      requiresReapproval: false,
      message: "Provider mutation timed out — state may be indeterminate.",
      suggestedAction: "Verify provider state before retrying with the same idempotency key.",
    };
  }

  if (code.includes("PERMISSION") || code.includes("USER_PERMISSION_DENIED")) {
    return {
      kind: "PERMISSION_LOST",
      retryable: false,
      requiresReapproval: true,
      message: "Account permission was lost or revoked.",
      suggestedAction: "Reconnect Google Ads and re-verify account access.",
    };
  }

  if (code.includes("SUSPENDED")) {
    return {
      kind: "ACCOUNT_SUSPENDED",
      retryable: false,
      requiresReapproval: true,
      message: "Google Ads account is suspended.",
      suggestedAction: "Resolve account suspension with Google before retrying.",
    };
  }

  if (code.includes("POLICY")) {
    return {
      kind: "POLICY_REJECTION",
      retryable: false,
      requiresReapproval: true,
      message: "Google Ads policy rejected the mutation.",
      suggestedAction: "Update creative/keywords and re-validate before launch.",
    };
  }

  if (code.includes("RESOURCE_EXHAUSTED") || code.includes("QUOTA")) {
    return {
      kind: "QUOTA_EXHAUSTED",
      retryable: true,
      requiresReapproval: false,
      message: "Google Ads API quota exhausted.",
      suggestedAction: "Wait and retry with exponential backoff.",
    };
  }

  return {
    kind: "STATE_MISMATCH",
    retryable: false,
    requiresReapproval: false,
    message: error.message ?? "Unknown provider error.",
    suggestedAction: "Compare internal mapping with provider state.",
  };
}

export function shouldUseIdempotentRetry(existingResourceCount: number, error: RecoveryAction): boolean {
  return existingResourceCount > 0 && error.kind === "TIMEOUT_AFTER_MUTATION";
}
