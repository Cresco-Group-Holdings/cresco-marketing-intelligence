import type { NotificationCategory } from "@prisma/client";

export const INBOX_SECTIONS = [
  "ALL",
  "ASSIGNED",
  "APPROVALS",
  "MENTIONS",
  "CAMPAIGNS",
  "PUBLISHING",
  "INTEGRATIONS",
  "CRM",
  "AI",
  "SYSTEM",
] as const;

export type InboxSectionKey = (typeof INBOX_SECTIONS)[number];

export const SECTION_LABELS: Record<InboxSectionKey, string> = {
  ALL: "All",
  ASSIGNED: "Assigned to me",
  APPROVALS: "Approvals",
  MENTIONS: "Mentions",
  CAMPAIGNS: "Campaigns",
  PUBLISHING: "Publishing",
  INTEGRATIONS: "Integrations",
  CRM: "CRM",
  AI: "AI",
  SYSTEM: "System",
};

const CATEGORY_SECTION_MAP: Record<NotificationCategory, InboxSectionKey> = {
  CONTENT: "CAMPAIGNS",
  APPROVAL: "APPROVALS",
  SCHEDULING: "CAMPAIGNS",
  PUBLISHING: "PUBLISHING",
  CONNECTION: "INTEGRATIONS",
  ANALYTICS: "SYSTEM",
  INBOX: "MENTIONS",
  LEAD: "CRM",
  SECURITY: "SYSTEM",
  SYSTEM: "SYSTEM",
};

export function categoryToInboxSection(category: NotificationCategory): InboxSectionKey {
  return CATEGORY_SECTION_MAP[category] ?? "SYSTEM";
}

export function eventTypeToSection(eventType: string, category: NotificationCategory): InboxSectionKey {
  if (eventType.includes("mention")) return "MENTIONS";
  if (eventType.includes("assign")) return "ASSIGNED";
  if (eventType.includes("ai.") || eventType.includes("recommendation")) return "AI";
  return categoryToInboxSection(category);
}
