import { createHash } from "crypto";
import {
  DEFAULT_DAILY_EXECUTION_LIMIT,
  DEFAULT_MONTHLY_QUOTA,
  MAX_TRIGGER_DEPTH,
} from "./constants";

export function buildDefinitionHash(input: {
  triggers: unknown[];
  conditions: unknown[];
  actions: unknown[];
}): string {
  const payload = JSON.stringify(input);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function buildIdempotencyKey(
  workflowId: string,
  eventType: string,
  resourceId: string,
  suffix?: string,
): string {
  const base = `${workflowId}:${eventType}:${resourceId}`;
  return suffix ? `${base}:${suffix}` : base;
}

export function canTriggerWorkflow(input: {
  preventSelfTrigger: boolean;
  triggerDepth: number;
  sourceWorkflowId?: string;
  targetWorkflowId: string;
  eventType: string;
}): { allowed: boolean; reason?: string } {
  if (input.triggerDepth >= MAX_TRIGGER_DEPTH) {
    return { allowed: false, reason: "Maximum automation trigger depth exceeded." };
  }
  if (
    input.preventSelfTrigger &&
    input.sourceWorkflowId &&
    input.sourceWorkflowId === input.targetWorkflowId
  ) {
    return { allowed: false, reason: "Workflow cannot trigger itself." };
  }
  if (input.eventType === "AUTOMATION_COMPLETED" && input.triggerDepth > 0) {
    return { allowed: false, reason: "Chained automation completion triggers are blocked." };
  }
  return { allowed: true };
}

export function checkDailyExecutionLimit(
  countToday: number,
  limit?: number | null,
): { allowed: boolean; reason?: string } {
  const effectiveLimit = limit ?? DEFAULT_DAILY_EXECUTION_LIMIT;
  if (countToday >= effectiveLimit) {
    return { allowed: false, reason: "Daily execution limit reached for this workflow." };
  }
  return { allowed: true };
}

export function checkMonthlyQuota(
  countThisMonth: number,
  quota?: number | null,
): { allowed: boolean; reason?: string } {
  const effectiveQuota = quota ?? DEFAULT_MONTHLY_QUOTA;
  if (countThisMonth >= effectiveQuota) {
    return { allowed: false, reason: "Monthly automation quota reached for this brand." };
  }
  return { allowed: true };
}

export function shouldDeadLetter(attemptCount: number, maxAttempts: number): boolean {
  return attemptCount >= maxAttempts;
}

export function monthStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function dayStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
