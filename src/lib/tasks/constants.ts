import type { MarketingTaskStatus } from "@prisma/client";

export const TASK_STATUS_LABELS: Record<MarketingTaskStatus, string> = {
  BACKLOG: "Backlog",
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  IN_REVIEW: "In review",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export const TASK_PRIORITY_LABELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
} as const;

export const TASK_TYPE_LABELS = {
  GENERAL: "General",
  CONTENT: "Content",
  CAMPAIGN: "Campaign",
  ASSET: "Asset",
  EXPERIMENT: "Experiment",
  APPROVAL: "Approval",
  REVIEW: "Review",
  PUBLISHING: "Publishing",
  COMPLIANCE: "Compliance",
  OTHER: "Other",
} as const;

export const APPROVAL_TYPE_LABELS = {
  CONTENT: "Content",
  CAMPAIGN_ACTIVATION: "Campaign activation",
  BUDGET_CHANGE: "Budget change",
  ASSET_APPROVAL: "Asset approval",
  AI_ACTION: "AI action",
  OTHER: "Other",
} as const;

export const BOARD_COLUMNS: MarketingTaskStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
];

export const TERMINAL_TASK_STATUSES: MarketingTaskStatus[] = ["DONE", "CANCELLED"];

export const DEFAULT_CHECKLIST_ITEMS = [
  "Review requirements",
  "Complete work",
  "Verify output",
  "Request approval",
];
