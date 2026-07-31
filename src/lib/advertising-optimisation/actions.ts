import { isMaterialAction } from "./recommendations";

export type ActionProposalInput = {
  actionClass: string;
  title: string;
  description: string;
  payload?: Record<string, unknown>;
  fromLlmOutput?: boolean;
};

export type ActionProposalResult = {
  allowed: boolean;
  requiresApproval: boolean;
  status: "PENDING" | "BLOCKED";
  blockedReason: string | null;
};

export function evaluateActionProposal(input: ActionProposalInput): ActionProposalResult {
  const requiresApproval = isMaterialAction(input.actionClass) || input.actionClass !== "INFORMATION_ONLY";

  if (input.fromLlmOutput && input.actionClass === "REQUEST_PROVIDER_CHANGE") {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: "Provider changes cannot be applied directly from LLM output.",
    };
  }

  if (input.fromLlmOutput && input.actionClass === "REQUEST_BUDGET_CHANGE") {
    return {
      allowed: false,
      requiresApproval: true,
      status: "BLOCKED",
      blockedReason: "Budget changes from LLM output require human review and approval workflow.",
    };
  }

  return {
    allowed: true,
    requiresApproval,
    status: "PENDING",
    blockedReason: null,
  };
}

export function canApplyAction(status: string, approved: boolean): boolean {
  if (status === "BLOCKED") return false;
  if (status === "PENDING" && !approved) return false;
  return approved;
}
