import { createHash } from "crypto";
import { REQUIRED_APPROVAL_BINDINGS } from "./constants";
import type { AutomationGraph } from "./graph-validation";

export { REQUIRED_APPROVAL_BINDINGS };

export type VersionApprovalBinding = {
  triggerHash?: string | null;
  conditionGraphHash?: string | null;
  actionGraphHash?: string | null;
  templateHash?: string | null;
  delayHash?: string | null;
  frequencyLimitHash?: string | null;
  exitRuleHash?: string | null;
};

export type VersionApprovalRecord = VersionApprovalBinding & {
  status: string;
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashGraphComponents(graph: AutomationGraph): VersionApprovalBinding {
  const triggerNode = graph.nodes.find((node) => node.type === "TRIGGER");
  const conditionNodes = graph.nodes
    .filter((node) => node.type === "CONDITION" || node.type === "BRANCH")
    .map((node) => ({ id: node.id, config: node.config ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const actionNodes = graph.nodes
    .filter((node) => node.type === "ACTION")
    .map((node) => ({ id: node.id, config: node.config ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const delayNodes = graph.nodes
    .filter((node) => node.type === "DELAY")
    .map((node) => ({ id: node.id, config: node.config ?? {} }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const hash = (input: unknown) => createHash("sha256").update(stableStringify(input)).digest("hex");

  return {
    triggerHash: hash(triggerNode?.config ?? {}),
    conditionGraphHash: hash(conditionNodes),
    actionGraphHash: hash(actionNodes),
    templateHash: hash(
      actionNodes
        .map((n) => n.config)
        .filter((c) => c.actionType === "SEND_EMAIL"),
    ),
    delayHash: hash(delayNodes),
    frequencyLimitHash: hash(graph.exitRules ?? []),
    exitRuleHash: hash(graph.exitRules ?? []),
  };
}

export function isApprovalValid(
  approval: VersionApprovalRecord,
  current: VersionApprovalBinding,
): { valid: boolean; reason?: string } {
  if (approval.status !== "APPROVED") {
    return { valid: false, reason: "Approval not granted." };
  }

  const bindings: Array<[keyof VersionApprovalBinding, string]> = [
    ["triggerHash", "Trigger configuration"],
    ["conditionGraphHash", "Condition graph"],
    ["actionGraphHash", "Action graph"],
    ["templateHash", "Email templates"],
    ["delayHash", "Delays"],
    ["frequencyLimitHash", "Frequency limits"],
    ["exitRuleHash", "Exit rules"],
  ];

  for (const [key, label] of bindings) {
    const approved = approval[key];
    const currentVal = current[key];
    if (approved && currentVal && approved !== currentVal) {
      return { valid: false, reason: `${label} changed since approval.` };
    }
  }

  return { valid: true };
}

export function evaluateRequiredApprovals(
  approvals: VersionApprovalRecord[],
  current: VersionApprovalBinding,
): { complete: boolean; pending: string[]; stale: string[] } {
  const approved = approvals.find((a) => a.status === "APPROVED");
  if (!approved) {
    return { complete: false, pending: [...REQUIRED_APPROVAL_BINDINGS], stale: [] };
  }
  const validation = isApprovalValid(approved, current);
  if (!validation.valid) {
    return { complete: false, pending: [], stale: [...REQUIRED_APPROVAL_BINDINGS] };
  }
  return { complete: true, pending: [], stale: [] };
}
