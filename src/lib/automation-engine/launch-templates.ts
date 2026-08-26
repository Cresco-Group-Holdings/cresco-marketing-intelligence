import type { AutomationActionType, AutomationEventType } from "./constants";

export type LaunchAutomationTemplate = {
  key: string;
  name: string;
  description: string;
  category: "monitor" | "content" | "reporting" | "campaign";
  triggerKind: "EVENT" | "SCHEDULE";
  eventType?: AutomationEventType;
  scheduleCron?: string;
  conditions: Array<{ field: string; operator: string; value?: unknown }>;
  actions: Array<{
    actionType: AutomationActionType;
    config: Record<string, unknown>;
    maxRetries?: number;
  }>;
  defaultCadence: string;
  requiredCapabilities: string[];
  requiresApproval: boolean;
  supportedScope: "brand";
  prerequisites: string[];
};

export const LAUNCH_AUTOMATION_TEMPLATES: LaunchAutomationTemplate[] = [
  {
    key: "weekly-marketing-digest",
    name: "Weekly Marketing Digest",
    description:
      "Summarise performance changes, opportunities, risks, content performance, attribution, and priorities each week.",
    category: "reporting",
    triggerKind: "SCHEDULE",
    scheduleCron: "0 8 * * 1",
    conditions: [],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          generateWeeklyDigest: true,
          category: "REPORT",
          priority: "NORMAL",
          actionPath: "/dashboard",
        },
      },
    ],
    defaultCadence: "Weekly (Monday 08:00)",
    requiredCapabilities: ["analytics"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["At least one connected analytics provider"],
  },
  {
    key: "publishing-failure-alert",
    name: "Publishing Failure Alert",
    description: "Notify when a scheduled publication enters a failed state.",
    category: "monitor",
    triggerKind: "EVENT",
    eventType: "PUBLICATION_FAILED",
    conditions: [],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          title: "Scheduled publication failed",
          body: "A scheduled post failed to publish. Review and retry when ready.",
          category: "PUBLISHING",
          priority: "HIGH",
        },
      },
      {
        actionType: "CREATE_TASK",
        config: {
          title: "Review failed publication",
          taskTypeCode: "FOLLOW_UP",
        },
      },
    ],
    defaultCadence: "On failure",
    requiredCapabilities: ["publishing"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Active publishing channel"],
  },
  {
    key: "data-sync-failure-alert",
    name: "Data Sync Failure Alert",
    description: "Alert when provider sync fails repeatedly.",
    category: "monitor",
    triggerKind: "EVENT",
    eventType: "PROVIDER_SYNC_FAILED",
    conditions: [{ field: "event.attemptCount", operator: "greater_or_equal", value: 2 }],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          title: "Provider sync failing",
          body: "Data sync has failed multiple times. Check connection health.",
          category: "INTEGRATION",
          priority: "HIGH",
        },
      },
    ],
    defaultCadence: "On repeated failure",
    requiredCapabilities: ["provider_sync"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Connected provider account"],
  },
  {
    key: "performance-anomaly-alert",
    name: "Performance Anomaly Alert",
    description: "Trigger when an evidence-backed analytics threshold is breached.",
    category: "monitor",
    triggerKind: "EVENT",
    eventType: "ANALYTICS_THRESHOLD_BREACHED",
    conditions: [{ field: "kpi.variancePercent", operator: "less_than", value: -15 }],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          title: "Performance anomaly detected",
          body: "A key metric moved outside the expected range.",
          category: "ANALYTICS",
          priority: "HIGH",
        },
      },
    ],
    defaultCadence: "On anomaly",
    requiredCapabilities: ["analytics"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Analytics data synced within freshness window"],
  },
  {
    key: "no-content-scheduled-alert",
    name: "No Content Scheduled Alert",
    description: "Alert when an important channel has no upcoming scheduled content.",
    category: "content",
    triggerKind: "SCHEDULE",
    scheduleCron: "0 9 * * 1",
    conditions: [{ field: "content.upcomingCount", operator: "equals", value: 0 }],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          title: "No content scheduled",
          body: "An important channel has no upcoming posts. Plan content for the week.",
          category: "CONTENT",
          priority: "NORMAL",
        },
      },
    ],
    defaultCadence: "Weekly (Monday 09:00)",
    requiredCapabilities: ["publishing"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Publishing channel configured"],
  },
  {
    key: "winning-content-repurpose",
    name: "Winning Content Repurpose Reminder",
    description: "Remind the team when high-performing content qualifies for repurposing.",
    category: "content",
    triggerKind: "SCHEDULE",
    scheduleCron: "0 10 * * 3",
    conditions: [{ field: "event.resourceType", operator: "equals", value: "winning_content" }],
    actions: [
      {
        actionType: "CREATE_NOTIFICATION",
        config: {
          title: "Repurpose winning content",
          body: "High-performing content is ready for repurposing across channels.",
          category: "CONTENT",
          priority: "NORMAL",
        },
      },
    ],
    defaultCadence: "Weekly (Wednesday 10:00)",
    requiredCapabilities: ["organic_analytics"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Organic analytics"],
  },
  {
    key: "campaign-review-reminder",
    name: "Campaign Review Reminder",
    description: "Remind owners to review active campaigns on a recurring cadence.",
    category: "campaign",
    triggerKind: "SCHEDULE",
    scheduleCron: "0 9 * * 5",
    conditions: [{ field: "campaign.status", operator: "equals", value: "ACTIVE" }],
    actions: [
      {
        actionType: "CREATE_TASK",
        config: {
          title: "Review active campaign performance",
          taskTypeCode: "FOLLOW_UP",
        },
      },
    ],
    defaultCadence: "Weekly (Friday 09:00)",
    requiredCapabilities: ["campaigns"],
    requiresApproval: false,
    supportedScope: "brand",
    prerequisites: ["Active campaign"],
  },
];

export function getLaunchTemplate(key: string): LaunchAutomationTemplate | undefined {
  return LAUNCH_AUTOMATION_TEMPLATES.find((template) => template.key === key);
}

export function groupTemplatesByCategory() {
  return LAUNCH_AUTOMATION_TEMPLATES.reduce<Record<string, LaunchAutomationTemplate[]>>(
    (acc, template) => {
      acc[template.category] ??= [];
      acc[template.category].push(template);
      return acc;
    },
    {},
  );
}
