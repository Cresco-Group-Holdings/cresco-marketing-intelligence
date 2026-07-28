import type { ContentApprovalMode } from "@prisma/client";
import { AppError } from "@/lib/errors";

export type ContentWorkflowSettings = {
  approvalMode: ContentApprovalMode;
  separationOfDutiesEnabled: boolean;
};

export const DEFAULT_CONTENT_WORKFLOW_SETTINGS: ContentWorkflowSettings = {
  approvalMode: "ONE_APPROVER",
  separationOfDutiesEnabled: true,
};

export function assertCanApproveContent(input: {
  settings: ContentWorkflowSettings;
  approverUserId: string;
  createdByUserId: string;
  ownerUserId: string;
}): void {
  if (
    input.settings.separationOfDutiesEnabled &&
    (input.approverUserId === input.createdByUserId ||
      input.approverUserId === input.ownerUserId)
  ) {
    throw new AppError(
      "FORBIDDEN",
      "Creators cannot approve their own content when separation of duties is enabled.",
    );
  }
}

export function resolveStatusAfterApproval(mode: ContentApprovalMode): "APPROVED" | "IN_REVIEW" {
  if (mode === "NO_APPROVAL_REQUIRED") {
    return "APPROVED";
  }
  return "APPROVED";
}

export function requiresApproval(mode: ContentApprovalMode): boolean {
  return mode !== "NO_APPROVAL_REQUIRED";
}

export function supportsAdvancedApproval(mode: ContentApprovalMode): boolean {
  return mode === "TWO_APPROVERS" || mode === "COMPLIANCE_APPROVAL_REQUIRED";
}
