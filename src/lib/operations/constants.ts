import type { ContentAssignmentRole, ContentDeadlineType } from "@prisma/client";

export const DEFAULT_CHECKLIST_ITEMS: Array<{ itemKey: string; label: string }> = [
  { itemKey: "caption_complete", label: "Caption complete" },
  { itemKey: "cta_added", label: "CTA added" },
  { itemKey: "destination_url_checked", label: "Destination URL checked" },
  { itemKey: "asset_licence_checked", label: "Asset licence checked" },
  { itemKey: "alt_text_added", label: "Alt text added" },
  { itemKey: "subtitles_reviewed", label: "Subtitles reviewed" },
  { itemKey: "compliance_completed", label: "Compliance completed" },
  { itemKey: "final_approval_received", label: "Final approval received" },
];

export const ASSIGNMENT_ROLE_LABELS: Record<ContentAssignmentRole, string> = {
  CONTENT_OWNER: "Content owner",
  COPY_REVIEWER: "Copy reviewer",
  VISUAL_DESIGNER: "Visual designer",
  COMPLIANCE_REVIEWER: "Compliance reviewer",
  PUBLISHER: "Publisher",
  INBOX_OWNER: "Inbox owner",
};

export const DEADLINE_TYPE_LABELS: Record<ContentDeadlineType, string> = {
  CONTENT_DUE: "Content due date",
  REVIEW_DEADLINE: "Review deadline",
  APPROVAL_DEADLINE: "Approval deadline",
  PUBLISHING_DEADLINE: "Publishing deadline",
};

export const TASK_STATUS_LABELS = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const CAMPAIGN_STATUS_LABELS = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export const DUE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;
