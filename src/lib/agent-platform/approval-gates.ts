import type { AgentPlatformApprovalStatus } from "@prisma/client";
import { classifyProposedActionRisk } from "@/lib/agent-platform/safety";

export type ApprovalGateInput = {
  actionKey: string;
  riskLevel: "READ_ONLY" | "DRAFT" | "HIGH_IMPACT";
};

export function requiresHumanApproval(input: ApprovalGateInput): boolean {
  if (input.riskLevel === "HIGH_IMPACT") return true;
  return classifyProposedActionRisk(input.actionKey) === "HIGH_IMPACT";
}

export function canAutoExecute(_input: ApprovalGateInput): false {
  return false;
}

export function resolveApprovalStatus(
  current: AgentPlatformApprovalStatus,
  decision: "APPROVED" | "REJECTED",
): AgentPlatformApprovalStatus {
  if (current !== "PENDING") return current;
  return decision;
}

export function assertApprovalRequired(input: ApprovalGateInput) {
  return {
    requiresApproval: requiresHumanApproval(input),
    autoExecuteAllowed: false,
    message: requiresHumanApproval(input)
      ? "This action requires explicit human approval before execution."
      : "Proposed actions are recorded for review; v1 does not auto-execute.",
  };
}
