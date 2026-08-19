import type { PublicationStatus } from "@prisma/client";

const STATUS_LABELS: Record<PublicationStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Ready",
  QUEUED: "Queued",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  PARTIALLY_PUBLISHED: "Partially published",
  FAILED: "Failed",
  REQUIRES_REAUTH: "Reconnect required",
  CANCELLED: "Cancelled",
  REMOVED: "Removed",
};

export function publicationStatusLabel(status: PublicationStatus | string): string {
  return STATUS_LABELS[status as PublicationStatus] ?? status.replace(/_/g, " ").toLowerCase();
}

export function publicationStatusVariant(
  status: string,
): "default" | "muted" | "warning" | "success" {
  if (status === "PUBLISHED" || status === "APPROVED") return "success";
  if (
    status === "FAILED" ||
    status === "REQUIRES_REAUTH" ||
    status === "PENDING_APPROVAL" ||
    status === "PARTIALLY_PUBLISHED"
  ) {
    return "warning";
  }
  if (status === "PUBLISHING" || status === "QUEUED" || status === "SCHEDULED") return "default";
  return "muted";
}
