/** Canonical lead qualification flow for Stage 8 CRM core. */
export const CRM_LEAD_WORKFLOW_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFYING",
  "QUALIFIED",
  "OPPORTUNITY",
  "WON",
  "LOST",
] as const;

export type CrmLeadWorkflowStatus = (typeof CRM_LEAD_WORKFLOW_STATUSES)[number];

const ALLOWED_TRANSITIONS: Record<CrmLeadWorkflowStatus, CrmLeadWorkflowStatus[]> = {
  NEW: ["CONTACTED"],
  CONTACTED: ["QUALIFYING"],
  QUALIFYING: ["QUALIFIED", "LOST"],
  QUALIFIED: ["OPPORTUNITY", "LOST"],
  OPPORTUNITY: ["WON", "LOST"],
  WON: [],
  LOST: [],
};

export function isWorkflowStatus(status: string): status is CrmLeadWorkflowStatus {
  return (CRM_LEAD_WORKFLOW_STATUSES as readonly string[]).includes(status);
}

export function getAllowedNextStatuses(current: string): CrmLeadWorkflowStatus[] {
  if (!isWorkflowStatus(current)) return [];
  return ALLOWED_TRANSITIONS[current];
}

export function validateWorkflowTransition(
  currentStatus: string,
  nextStatus: string,
): { valid: boolean; error?: string } {
  if (!isWorkflowStatus(nextStatus)) {
    return { valid: false, error: `Invalid workflow status: ${nextStatus}` };
  }
  if (!isWorkflowStatus(currentStatus)) {
    return { valid: true };
  }
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${nextStatus}. Allowed: ${allowed.join(", ") || "none"}.`,
    };
  }
  return { valid: true };
}

export function mapWorkflowToQualificationState(
  status: CrmLeadWorkflowStatus,
): "UNASSESSED" | "IN_PROGRESS" | "QUALIFIED" | "DISQUALIFIED" {
  switch (status) {
    case "QUALIFYING":
      return "IN_PROGRESS";
    case "QUALIFIED":
    case "OPPORTUNITY":
    case "WON":
      return "QUALIFIED";
    case "LOST":
      return "DISQUALIFIED";
    default:
      return "UNASSESSED";
  }
}

export function mapWorkflowToLifecycleStage(
  status: CrmLeadWorkflowStatus,
): "LEAD" | "MARKETING_QUALIFIED" | "SALES_QUALIFIED" | "OPPORTUNITY" | "CUSTOMER" | "FORMER_CUSTOMER" {
  switch (status) {
    case "QUALIFIED":
      return "MARKETING_QUALIFIED";
    case "OPPORTUNITY":
      return "OPPORTUNITY";
    case "WON":
      return "CUSTOMER";
    case "LOST":
      return "FORMER_CUSTOMER";
    case "QUALIFYING":
      return "SALES_QUALIFIED";
    default:
      return "LEAD";
  }
}
