import { OrganisationRole } from "@prisma/client";
import {
  DEFAULT_ADMIN_APPROVAL_THRESHOLD_PCT,
  DEFAULT_HARD_LIMIT_PCT,
  DEFAULT_OWNER_APPROVAL_THRESHOLD_PCT,
} from "./constants";

export type ApprovalPolicyConfig = {
  marketerCanRequest: boolean;
  adminApprovalThresholdPct: number;
  ownerApprovalThresholdPct: number;
  hardLimitPct: number;
  clientApprovalRequired: boolean;
};

export type ApprovalEvaluationInput = {
  policy: ApprovalPolicyConfig;
  requesterRole: OrganisationRole;
  percentageChange: number;
  isIncrease: boolean;
  isManagedAccount?: boolean;
};

export type ApprovalEvaluationResult = {
  canRequest: boolean;
  requiredApprover: "ADMIN" | "OWNER" | "CLIENT" | "NONE";
  autoReject: boolean;
  reason: string;
};

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicyConfig = {
  marketerCanRequest: true,
  adminApprovalThresholdPct: DEFAULT_ADMIN_APPROVAL_THRESHOLD_PCT,
  ownerApprovalThresholdPct: DEFAULT_OWNER_APPROVAL_THRESHOLD_PCT,
  hardLimitPct: DEFAULT_HARD_LIMIT_PCT,
  clientApprovalRequired: false,
};

export function evaluateApprovalPolicy(input: ApprovalEvaluationInput): ApprovalEvaluationResult {
  const { policy, requesterRole, percentageChange, isIncrease, isManagedAccount } = input;
  const absChange = Math.abs(percentageChange);

  if (isIncrease && absChange > policy.hardLimitPct) {
    return {
      canRequest: false,
      requiredApprover: "NONE",
      autoReject: true,
      reason: `Increase of ${absChange.toFixed(1)}% exceeds hard limit of ${policy.hardLimitPct}%. Automatically rejected.`,
    };
  }

  const marketerRoles: OrganisationRole[] = ["MARKETER", "ADMIN", "OWNER"];
  const canRequest =
    policy.marketerCanRequest && marketerRoles.includes(requesterRole);

  if (!canRequest && requesterRole === "VIEWER") {
    return {
      canRequest: false,
      requiredApprover: "NONE",
      autoReject: true,
      reason: "Viewers cannot submit budget change requests.",
    };
  }

  if (isManagedAccount && policy.clientApprovalRequired) {
    return {
      canRequest: true,
      requiredApprover: "CLIENT",
      autoReject: false,
      reason: "Managed account requires client approval for all budget changes.",
    };
  }

  if (absChange <= policy.adminApprovalThresholdPct) {
    return {
      canRequest: true,
      requiredApprover: "ADMIN",
      autoReject: false,
      reason: `Change within admin threshold (${policy.adminApprovalThresholdPct}%).`,
    };
  }

  if (absChange <= policy.ownerApprovalThresholdPct) {
    return {
      canRequest: true,
      requiredApprover: "ADMIN",
      autoReject: false,
      reason: `Change within owner escalation threshold (${policy.ownerApprovalThresholdPct}%). Admin may approve.`,
    };
  }

  return {
    canRequest: true,
    requiredApprover: "OWNER",
    autoReject: false,
    reason: `Change of ${absChange.toFixed(1)}% requires owner approval.`,
  };
}

export function canRoleApprove(
  role: OrganisationRole,
  requiredApprover: ApprovalEvaluationResult["requiredApprover"],
): boolean {
  if (requiredApprover === "NONE") return false;
  if (requiredApprover === "CLIENT") return false;
  if (requiredApprover === "OWNER") return role === "OWNER";
  if (requiredApprover === "ADMIN") return role === "OWNER" || role === "ADMIN";
  return false;
}
