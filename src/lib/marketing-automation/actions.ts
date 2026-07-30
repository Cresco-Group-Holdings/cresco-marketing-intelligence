import {
  ACTION_TYPES,
  DISABLED_WITHOUT_APPROVAL,
  HIGH_RISK_ACTION_TYPES,
  WEBHOOK_ALLOWLIST,
  type ActionType,
} from "./constants";

const BLOCKED_WEBHOOK_HOSTS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\.0\.0\.0$/,
];

export function isValidActionType(value: string): value is ActionType {
  return (ACTION_TYPES as readonly string[]).includes(value);
}

export function isHighRiskAction(actionType: ActionType): boolean {
  return HIGH_RISK_ACTION_TYPES.includes(actionType);
}

export function isActionDisabledWithoutApproval(actionType: ActionType): boolean {
  return DISABLED_WITHOUT_APPROVAL.includes(actionType);
}

export function isWebhookUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (BLOCKED_WEBHOOK_HOSTS.some((pattern) => pattern.test(parsed.hostname))) return false;
    return WEBHOOK_ALLOWLIST.some((prefix) => url.startsWith(prefix));
  } catch {
    return false;
  }
}

export function validateActionConfig(
  actionType: ActionType,
  config: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isValidActionType(actionType)) {
    return { valid: false, errors: [`Invalid action type: ${actionType}`] };
  }

  switch (actionType) {
    case "SEND_EMAIL":
      if (!config.templateId && !config.templateKey) {
        errors.push("SEND_EMAIL requires templateId or templateKey.");
      }
      if (!config.senderIdentityId) {
        errors.push("SEND_EMAIL requires senderIdentityId.");
      }
      break;
    case "APPLY_TAG":
    case "REMOVE_TAG":
      if (!config.tag || typeof config.tag !== "string") {
        errors.push(`${actionType} requires tag.`);
      }
      break;
    case "UPDATE_LEAD_STATUS":
      if (!config.status || typeof config.status !== "string") {
        errors.push("UPDATE_LEAD_STATUS requires status.");
      }
      break;
    case "UPDATE_LIFECYCLE":
      if (!config.lifecycleStage || typeof config.lifecycleStage !== "string") {
        errors.push("UPDATE_LIFECYCLE requires lifecycleStage.");
      }
      break;
    case "ASSIGN_OWNER":
      if (!config.ownerUserId || typeof config.ownerUserId !== "string") {
        errors.push("ASSIGN_OWNER requires ownerUserId.");
      }
      break;
    case "CREATE_TASK":
      if (!config.title || typeof config.title !== "string") {
        errors.push("CREATE_TASK requires title.");
      }
      break;
    case "CREATE_OPPORTUNITY_PROPOSAL":
      if (!config.name || typeof config.name !== "string") {
        errors.push("CREATE_OPPORTUNITY_PROPOSAL requires name.");
      }
      break;
    case "ADD_TO_AUDIENCE":
    case "REMOVE_FROM_AUDIENCE":
      if (!config.segmentId || typeof config.segmentId !== "string") {
        errors.push(`${actionType} requires segmentId.`);
      }
      break;
    case "SEND_INTERNAL_NOTIFICATION":
      if (!config.message || typeof config.message !== "string") {
        errors.push("SEND_INTERNAL_NOTIFICATION requires message.");
      }
      break;
    case "WEBHOOK":
      if (!config.url || typeof config.url !== "string") {
        errors.push("WEBHOOK requires url.");
      } else if (!isWebhookUrlAllowed(config.url)) {
        errors.push("WEBHOOK url is not on the allowlist.");
      }
      break;
    case "WAIT":
    case "BRANCH":
    case "END":
      break;
    default:
      break;
  }

  return { valid: errors.length === 0, errors };
}
