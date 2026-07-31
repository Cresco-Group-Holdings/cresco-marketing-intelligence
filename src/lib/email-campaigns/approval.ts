import { APPROVAL_COUNT_TOLERANCE } from "@/lib/email-campaigns/constants";

export type ApprovalBinding = {
  contentHash?: string | null;
  audienceRuleHash?: string | null;
  recipientCountMin?: number | null;
  recipientCountMax?: number | null;
  scheduledAtBound?: Date | null;
};

export type ApprovalRecord = ApprovalBinding & {
  status: string;
  approvalType: string;
};

export function isApprovalValid(
  approval: ApprovalRecord,
  current: ApprovalBinding & { recipientCount: number; scheduledAt?: Date | null },
): { valid: boolean; reason?: string } {
  if (approval.status !== "APPROVED") return { valid: false, reason: "Approval not granted." };

  if (approval.contentHash && current.contentHash && approval.contentHash !== current.contentHash) {
    return { valid: false, reason: "Content hash changed since approval." };
  }
  if (approval.audienceRuleHash && current.audienceRuleHash && approval.audienceRuleHash !== current.audienceRuleHash) {
    return { valid: false, reason: "Audience rules changed since approval." };
  }
  if (approval.recipientCountMin != null && approval.recipientCountMax != null) {
    const tolerance = Math.ceil(current.recipientCount * APPROVAL_COUNT_TOLERANCE);
    const min = approval.recipientCountMin - tolerance;
    const max = approval.recipientCountMax + tolerance;
    if (current.recipientCount < min || current.recipientCount > max) {
      return { valid: false, reason: "Recipient count outside approved range." };
    }
  }
  if (approval.scheduledAtBound && current.scheduledAt) {
    const boundMs = approval.scheduledAtBound.getTime();
    const scheduledMs = current.scheduledAt.getTime();
    if (Math.abs(boundMs - scheduledMs) > 60_000) {
      return { valid: false, reason: "Schedule changed since approval." };
    }
  }
  return { valid: true };
}

export function invalidateApprovalsOnMaterialChange(
  approvals: ApprovalRecord[],
  current: ApprovalBinding,
): string[] {
  return approvals
    .filter((a) => a.status === "APPROVED")
    .filter((a) => !isApprovalValid(a, { ...current, recipientCount: current.recipientCountMin ?? 0 }).valid)
    .map((a) => a.approvalType);
}
