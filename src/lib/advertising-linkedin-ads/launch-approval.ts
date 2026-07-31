import { REQUIRED_LAUNCH_APPROVAL_TYPES, type LaunchApprovalType } from "./constants";

export type LaunchApprovalRecord = {
  approvalType: string;
  decision: string;
  planHash: string;
};

export function evaluateLaunchApprovals(approvals: LaunchApprovalRecord[], currentPlanHash: string) {
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

  return { complete: pending.length === 0 && stale.length === 0 && rejected.length === 0, pending, stale, rejected };
}
