import {
  SocialConversationStatus,
  SocialInboxPriority,
  SocialSafetyFlag,
} from "@prisma/client";

export const INBOX_CONVERSATION_STATUSES = Object.values(SocialConversationStatus);

export const INBOX_PRIORITIES = Object.values(SocialInboxPriority);

export const INBOX_SAFETY_FLAGS = Object.values(SocialSafetyFlag);

export const INBOX_CONVERSATION_STATUS_LABELS: Record<SocialConversationStatus, string> = {
  NEW: "New",
  OPEN: "Open",
  PENDING: "Pending",
  RESOLVED: "Resolved",
  SPAM: "Spam",
  ARCHIVED: "Archived",
};

export const INBOX_PRIORITY_LABELS: Record<SocialInboxPriority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const INBOX_SAFETY_FLAG_LABELS: Record<SocialSafetyFlag, string> = {
  SPAM: "Possible spam",
  ABUSIVE_LANGUAGE: "Abusive language",
  PERSONAL_DATA: "Personal data detected",
  THREAT: "Possible threat",
  FINANCIAL_ADVICE: "Financial advice",
  GRANT_ELIGIBILITY: "Grant eligibility claim",
  COMPLAINT_REVIEW: "Complaint requiring review",
};

export const INBOX_DEFAULT_LIST_LIMIT = 25;
export const INBOX_MAX_LIST_LIMIT = 100;
export const INBOX_MAX_REPLY_LENGTH = 5_000;
export const INBOX_MAX_TAG_LENGTH = 100;
