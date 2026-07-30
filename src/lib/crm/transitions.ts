import { CRM_LEAD_STATUSES, CRM_LIFECYCLE_STAGES } from "./constants";

export type TransitionInput = {
  previousValue: string | null;
  newValue: string;
  actorUserId?: string;
  reason?: string;
  source?: string;
};

export function validateStatusTransition(newStatus: string): { valid: boolean; error?: string } {
  if (!(CRM_LEAD_STATUSES as readonly string[]).includes(newStatus)) {
    return { valid: false, error: `Invalid status: ${newStatus}` };
  }
  return { valid: true };
}

export function validateLifecycleTransition(newStage: string): { valid: boolean; error?: string } {
  if (!(CRM_LIFECYCLE_STAGES as readonly string[]).includes(newStage)) {
    return { valid: false, error: `Invalid lifecycle stage: ${newStage}` };
  }
  return { valid: true };
}

export function buildTransitionRecord(input: TransitionInput) {
  return {
    previousValue: input.previousValue,
    newValue: input.newValue,
    actorUserId: input.actorUserId ?? null,
    reason: input.reason ?? null,
    source: input.source ?? "MANUAL",
    timestamp: new Date(),
  };
}
