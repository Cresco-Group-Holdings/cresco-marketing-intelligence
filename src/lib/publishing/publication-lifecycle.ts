import type { PublicationStatus } from "@prisma/client";
import { AppError } from "@/lib/errors";

/** Validated Publication status transitions for the canonical publishing path. */
const ALLOWED_TRANSITIONS: Record<PublicationStatus, PublicationStatus[]> = {
  DRAFT: ["PENDING_APPROVAL", "APPROVED", "SCHEDULED", "QUEUED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "SCHEDULED", "CANCELLED"],
  APPROVED: ["QUEUED", "SCHEDULED", "PUBLISHING", "CANCELLED"],
  SCHEDULED: ["QUEUED", "PUBLISHING", "CANCELLED"],
  QUEUED: ["PUBLISHING", "CANCELLED", "FAILED", "REQUIRES_REAUTH"],
  PUBLISHING: ["PUBLISHED", "PARTIALLY_PUBLISHED", "FAILED", "SCHEDULED", "REQUIRES_REAUTH"],
  PUBLISHED: ["REMOVED"],
  PARTIALLY_PUBLISHED: ["QUEUED", "FAILED", "PUBLISHED", "REQUIRES_REAUTH"],
  FAILED: ["QUEUED", "CANCELLED", "REQUIRES_REAUTH"],
  REQUIRES_REAUTH: ["QUEUED", "CANCELLED"],
  CANCELLED: [],
  REMOVED: [],
};

// Publication uses PUBLISHING not PROCESSING — map conceptual PROCESSING to PUBLISHING
export function assertPublicationTransition(from: PublicationStatus, to: PublicationStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid publication transition from ${from} to ${to}.`,
    );
  }
}

export function transitionPublicationStatus(
  from: PublicationStatus,
  to: PublicationStatus,
): PublicationStatus {
  assertPublicationTransition(from, to);
  return to;
}

export function isPublicationExecutable(status: PublicationStatus): boolean {
  return ["APPROVED", "SCHEDULED", "QUEUED"].includes(status);
}

export function isPublicationTerminal(status: PublicationStatus): boolean {
  return ["PUBLISHED", "FAILED", "CANCELLED", "REMOVED"].includes(status);
}

export function mapTokenFailureToPublicationStatus(
  tokenStatus: string,
): { status: PublicationStatus; errorCode: string } {
  if (tokenStatus === "REAUTH_REQUIRED" || tokenStatus === "REVOKED") {
    return { status: "REQUIRES_REAUTH", errorCode: "REAUTH_REQUIRED" };
  }
  if (tokenStatus === "REFRESH_FAILED") {
    return { status: "REQUIRES_REAUTH", errorCode: "TOKEN_REFRESH_FAILED" };
  }
  return { status: "REQUIRES_REAUTH", errorCode: "PROVIDER_AUTH_FAILED" };
}
