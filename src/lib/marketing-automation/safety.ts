import {
  CYCLE_DETECTION_BOUND,
  DEFAULT_ACTION_FREQUENCY,
  FREQUENCY_LIMITS,
  MAX_AUTOMATION_RECURSION_DEPTH,
  type ActionType,
} from "./constants";
import { isHighRiskAction } from "./actions";
import type { AutomationGraph } from "./graph-validation";

export type ActionFrequencyRecord = {
  actionType: ActionType;
  executedAt: Date;
};

export type EnrollmentRecord = {
  automationId: string;
  leadId: string;
  status: "ACTIVE" | "COMPLETED" | "EXITED";
  enrolledAt: Date;
};

export type GraphSafetyResult = {
  safe: boolean;
  issues: string[];
};

function buildAdjacency(graph: AutomationGraph): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }
  return adjacency;
}

export function detectCycles(
  graph: AutomationGraph,
  bound = CYCLE_DETECTION_BOUND,
): { hasCycle: boolean; path?: string[] } {
  const adjacency = buildAdjacency(graph);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  let steps = 0;

  function dfs(nodeId: string, path: string[]): { hasCycle: boolean; path?: string[] } {
    if (steps++ > bound) {
      return { hasCycle: true, path: [...path, nodeId] };
    }
    if (visiting.has(nodeId)) {
      return { hasCycle: true, path: [...path, nodeId] };
    }
    if (visited.has(nodeId)) return { hasCycle: false };

    visiting.add(nodeId);
    for (const nextId of adjacency.get(nodeId) ?? []) {
      const result = dfs(nextId, [...path, nodeId]);
      if (result.hasCycle) return result;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return { hasCycle: false };
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      const result = dfs(node.id, []);
      if (result.hasCycle) return result;
    }
  }

  return { hasCycle: false };
}

export function checkActionFrequency(
  actionType: ActionType,
  history: ActionFrequencyRecord[],
  now = new Date(),
): { allowed: boolean; reason?: string } {
  const limits = FREQUENCY_LIMITS[actionType] ?? DEFAULT_ACTION_FREQUENCY;
  const dayStart = new Date(now.getTime() - 24 * 3_600_000);
  const weekStart = new Date(now.getTime() - 7 * 86_400_000);

  const dayCount = history.filter(
    (record) => record.actionType === actionType && record.executedAt >= dayStart,
  ).length;
  const weekCount = history.filter(
    (record) => record.actionType === actionType && record.executedAt >= weekStart,
  ).length;

  if (dayCount >= limits.perDay) {
    return { allowed: false, reason: `Action ${actionType} exceeds daily frequency limit.` };
  }
  if (weekCount >= limits.perWeek) {
    return { allowed: false, reason: `Action ${actionType} exceeds weekly frequency limit.` };
  }

  return { allowed: true };
}

export function checkDuplicateEnrollment(
  automationId: string,
  leadId: string,
  enrollments: EnrollmentRecord[],
): { allowed: boolean; reason?: string } {
  const active = enrollments.find(
    (enrollment) =>
      enrollment.automationId === automationId &&
      enrollment.leadId === leadId &&
      enrollment.status === "ACTIVE",
  );
  if (active) {
    return { allowed: false, reason: "Lead is already actively enrolled in this automation." };
  }
  return { allowed: true };
}

export function checkAutomationRecursion(
  chain: string[],
  targetAutomationId: string,
): { allowed: boolean; reason?: string } {
  const occurrences = chain.filter((id) => id === targetAutomationId).length;
  if (occurrences >= MAX_AUTOMATION_RECURSION_DEPTH) {
    return { allowed: false, reason: "Automation recursion limit reached." };
  }
  if (chain.includes(targetAutomationId)) {
    return { allowed: false, reason: "Circular automation enrollment detected." };
  }
  return { allowed: true };
}

export function validateGraphSafety(graph: AutomationGraph): GraphSafetyResult {
  const issues: string[] = [];

  const cycle = detectCycles(graph);
  if (cycle.hasCycle) {
    issues.push("Graph contains a cycle.");
  }

  const actionNodes = graph.nodes.filter((node) => node.type === "ACTION");
  for (const node of actionNodes) {
    const actionType = String(node.config?.actionType ?? "");
    if (actionType && isHighRiskAction(actionType as ActionType) && !node.config?.requiresApproval) {
      issues.push(`High-risk action node ${node.id} must declare requiresApproval.`);
    }
    if (actionType === "WEBHOOK") {
      const url = node.config?.url;
      if (typeof url === "string" && !url.startsWith("https://")) {
        issues.push(`Webhook action node ${node.id} must use HTTPS.`);
      }
    }
  }

  const webhookActions = actionNodes.filter((node) => node.config?.actionType === "WEBHOOK");
  if (webhookActions.length > 3) {
    issues.push("Graph contains too many webhook actions.");
  }

  return { safe: issues.length === 0, issues };
}
