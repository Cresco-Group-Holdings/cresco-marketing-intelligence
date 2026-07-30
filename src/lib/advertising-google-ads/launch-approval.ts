import { REQUIRED_LAUNCH_APPROVAL_TYPES, type LaunchApprovalType } from "./constants";

export type LaunchApprovalRecord = {
  approvalType: string;
  decision: string;
  planHash: string;
  approvedAt?: Date | null;
};

export type LaunchApprovalGateResult = {
  complete: boolean;
  pending: LaunchApprovalType[];
  stale: LaunchApprovalType[];
  rejected: LaunchApprovalType[];
};

export function evaluateLaunchApprovals(
  approvals: LaunchApprovalRecord[],
  currentPlanHash: string,
): LaunchApprovalGateResult {
  const pending: LaunchApprovalType[] = [];
  const stale: LaunchApprovalType[] = [];
  const rejected: LaunchApprovalType[] = [];

  for (const type of REQUIRED_LAUNCH_APPROVAL_TYPES) {
    const record = approvals.find((a) => a.approvalType === type);
    if (!record || record.decision === "PENDING") {
      pending.push(type);
      continue;
    }
    if (record.decision === "REJECTED") {
      rejected.push(type);
      continue;
    }
    if (record.decision === "APPROVED" && record.planHash !== currentPlanHash) {
      stale.push(type);
    }
  }

  return {
    complete: pending.length === 0 && stale.length === 0 && rejected.length === 0,
    pending,
    stale,
    rejected,
  };
}

export function invalidateApprovalsOnMaterialChange(
  previousHash: string,
  newHash: string,
  approvals: LaunchApprovalRecord[],
): LaunchApprovalRecord[] {
  if (previousHash === newHash) return approvals;
  return approvals.map((a) =>
    a.decision === "APPROVED" ? { ...a, decision: "STALE", planHash: newHash } : a,
  );
}
