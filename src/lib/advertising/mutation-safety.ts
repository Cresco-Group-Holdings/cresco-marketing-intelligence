import { createHash } from "crypto";

export type MutationPlanRecord = {
  planHash: string;
  operations: unknown[];
};

export type ApprovalRecord = {
  approvalType: string;
  decision: string;
  planHash: string;
};

export function hashMutationPlan(operations: unknown[]): string {
  const canonical = JSON.stringify(operations, Object.keys(operations).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function planHashMatches(storedHash: string, operations: unknown[]): boolean {
  return storedHash === hashMutationPlan(operations);
}

export function buildIdempotencyKey(provider: string, planId: string, planHash: string, version: number): string {
  return createHash("sha256").update(`${provider}:${planId}:${planHash}:${version}`).digest("hex");
}

export function evaluateApprovalBinding(
  approvals: ApprovalRecord[],
  currentPlanHash: string,
  requiredTypes: string[],
): {
  complete: boolean;
  pending: string[];
  stale: string[];
  rejected: string[];
} {
  const pending: string[] = [];
  const stale: string[] = [];
  const rejected: string[] = [];

  for (const type of requiredTypes) {
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

export function detectProviderStateDrift(
  expected: Record<string, unknown>,
  actual: Record<string, unknown>,
): { drifted: boolean; fields: string[] } {
  const fields: string[] = [];
  for (const key of Object.keys(expected)) {
    if (JSON.stringify(expected[key]) !== JSON.stringify(actual[key])) {
      fields.push(key);
    }
  }
  return { drifted: fields.length > 0, fields };
}

export function assertNoDirectLlmMutation(fromLlmOutput: boolean, actionClass: string): void {
  const blocked = ["REQUEST_PROVIDER_CHANGE", "REQUEST_BUDGET_CHANGE", "REQUEST_PAUSE", "REQUEST_RESUME"];
  if (fromLlmOutput && blocked.includes(actionClass)) {
    throw new Error("Direct LLM mutation is prohibited. Human approval workflow required.");
  }
}
