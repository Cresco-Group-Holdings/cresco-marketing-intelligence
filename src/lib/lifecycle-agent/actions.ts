import { BLOCKED_AUTONOMOUS_ACTIONS } from "./constants";
import { isMaterialAction } from "./recommendations";

export type ActionProposalInput = {
  actionClass: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  fromLlmOutput?: boolean;
  autonomous?: boolean;
};

export type ActionProposalResult = {
  allowed: boolean;
  requiresApproval: boolean;
  status: "PENDING" | "BLOCKED";
  blockedReason: string | null;
  blockedAutonomousAction: string | null;
};

export function evaluateActionProposal(input: ActionProposalInput): ActionProposalResult {
  const requiresApproval =
    isMaterialAction(input.actionClass) || input.actionClass !== "INFORMATION_ONLY";

  const blockedCheck = detectBlockedAutonomousAction(input);
  if (blockedCheck) {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: blockedCheck.reason,
      blockedAutonomousAction: blockedCheck.action,
    };
  }

  if (input.fromLlmOutput && input.actionClass === "DRAFT_MESSAGE") {
    return {
      allowed: true,
      requiresApproval: true,
      status: "PENDING",
      blockedReason: null,
      blockedAutonomousAction: null,
    };
  }

  if (input.fromLlmOutput && input.actionClass === "REQUEST_STAGE_CHANGE") {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: "Stage changes cannot be applied directly from LLM output.",
      blockedAutonomousAction: "AUTO_STAGE_CHANGE",
    };
  }

  if (input.fromLlmOutput && input.actionClass === "REQUEST_OWNER_ASSIGNMENT") {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: "Owner assignment from LLM output requires human review.",
      blockedAutonomousAction: null,
    };
  }

  if (input.autonomous && input.actionClass !== "INFORMATION_ONLY") {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: "Autonomous CRM actions are not permitted.",
      blockedAutonomousAction: "AUTO_LIFECYCLE_CHANGE",
    };
  }

  return {
    allowed: true,
    requiresApproval,
    status: "PENDING",
    blockedReason: null,
    blockedAutonomousAction: null,
  };
}

function detectBlockedAutonomousAction(
  input: ActionProposalInput,
): { action: string; reason: string } | null {
  const payload = input.payload ?? {};

  if (input.actionClass === "DRAFT_MESSAGE" && (input.autonomous || payload.autoSend === true)) {
    return {
      action: "AUTO_SEND_MESSAGE",
      reason: "Messages cannot be sent autonomously. Drafts require human review and manual send.",
    };
  }

  if (payload.actionType === "PRICE_CHANGE" || payload.priceChange !== undefined) {
    return {
      action: "AUTO_PRICE_CHANGE",
      reason: "Price changes are never applied autonomously.",
    };
  }

  if (payload.actionType === "DISCOUNT" || payload.discount !== undefined) {
    return {
      action: "AUTO_DISCOUNT",
      reason: "Discounts are never applied autonomously.",
    };
  }

  if (payload.actionType === "DEAL_WON" || payload.status === "WON" || payload.markWon === true) {
    return {
      action: "AUTO_DEAL_WON",
      reason: "Deals cannot be marked as won autonomously. Won status requires authorised confirmation.",
    };
  }

  if (input.autonomous && (BLOCKED_AUTONOMOUS_ACTIONS as readonly string[]).includes(input.actionClass)) {
    return {
      action: input.actionClass,
      reason: `Autonomous action ${input.actionClass} is prohibited.`,
    };
  }

  return null;
}

export function canApplyAction(status: string, approved: boolean): boolean {
  if (status === "BLOCKED") return false;
  if (status === "PENDING" && !approved) return false;
  return approved;
}

export function isBlockedAutonomousAction(actionType: string): boolean {
  return (BLOCKED_AUTONOMOUS_ACTIONS as readonly string[]).includes(actionType);
}
