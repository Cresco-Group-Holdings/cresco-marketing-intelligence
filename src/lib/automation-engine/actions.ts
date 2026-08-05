import {
  ALLOWED_CAMPAIGN_STATUS_TRANSITIONS,
  AUTOMATION_ACTION_TYPES,
  type AutomationActionType,
} from "./constants";

export function isValidActionType(value: string): value is AutomationActionType {
  return (AUTOMATION_ACTION_TYPES as readonly string[]).includes(value);
}

export function validateActionConfig(
  actionType: AutomationActionType,
  config: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (actionType) {
    case "CREATE_TASK":
      if (!config.title || typeof config.title !== "string") errors.push("CREATE_TASK requires title.");
      break;
    case "UPDATE_CAMPAIGN_STATUS":
      if (!config.campaignId || typeof config.campaignId !== "string") {
        errors.push("UPDATE_CAMPAIGN_STATUS requires campaignId.");
      }
      if (!config.status || typeof config.status !== "string") {
        errors.push("UPDATE_CAMPAIGN_STATUS requires status.");
      }
      break;
    case "ASSIGN_USER":
      if (!config.userId || typeof config.userId !== "string") errors.push("ASSIGN_USER requires userId.");
      if (!config.resourceType || typeof config.resourceType !== "string") {
        errors.push("ASSIGN_USER requires resourceType.");
      }
      if (!config.resourceId || typeof config.resourceId !== "string") {
        errors.push("ASSIGN_USER requires resourceId.");
      }
      break;
    case "REQUEST_APPROVAL":
      if (!config.approverUserId || typeof config.approverUserId !== "string") {
        errors.push("REQUEST_APPROVAL requires approverUserId.");
      }
      break;
    case "CREATE_NOTIFICATION":
      if (!config.title || typeof config.title !== "string") errors.push("CREATE_NOTIFICATION requires title.");
      if (!config.recipientUserIds || !Array.isArray(config.recipientUserIds)) {
        errors.push("CREATE_NOTIFICATION requires recipientUserIds array.");
      }
      break;
    case "ADD_CRM_ACTIVITY":
      if (!config.title || typeof config.title !== "string") errors.push("ADD_CRM_ACTIVITY requires title.");
      break;
    case "UPDATE_LEAD_STATUS":
      if (!config.leadId || typeof config.leadId !== "string") errors.push("UPDATE_LEAD_STATUS requires leadId.");
      if (!config.status || typeof config.status !== "string") errors.push("UPDATE_LEAD_STATUS requires status.");
      break;
    case "CREATE_CALENDAR_EVENT":
      if (!config.title || typeof config.title !== "string") {
        errors.push("CREATE_CALENDAR_EVENT requires title.");
      }
      if (!config.scheduledAt || typeof config.scheduledAt !== "string") {
        errors.push("CREATE_CALENDAR_EVENT requires scheduledAt.");
      }
      break;
    default:
      errors.push(`Unknown action type: ${actionType}`);
  }

  return { valid: errors.length === 0, errors };
}

export function canTransitionCampaignStatus(current: string, next: string): boolean {
  const allowed = ALLOWED_CAMPAIGN_STATUS_TRANSITIONS[current] ?? [];
  return allowed.includes(next);
}

export function buildDryRunPlan(
  actions: Array<{ actionType: AutomationActionType; config: Record<string, unknown> }>,
): Array<{ actionType: AutomationActionType; summary: string }> {
  return actions.map((action) => ({
    actionType: action.actionType,
    summary: `${action.actionType} with keys: ${Object.keys(action.config).join(", ")}`,
  }));
}
