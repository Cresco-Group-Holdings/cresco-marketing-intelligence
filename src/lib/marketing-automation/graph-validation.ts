import {
  MAX_GRAPH_DEPTH,
  MAX_GRAPH_NODES,
  MAX_PATH_COUNT,
  NODE_TYPES,
  type NodeType,
} from "./constants";

export type AutomationNode = {
  id: string;
  type: NodeType;
  label?: string;
  config?: Record<string, unknown>;
};

export type AutomationEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
};

export type AutomationGraph = {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  exitRules?: Array<{
    type?: string;
    config?: Record<string, unknown>;
    exitReason?: string;
    evaluateBeforeMessaging?: boolean;
  }>;
};

export type GraphValidationResult = {
  valid: boolean;
  errors: string[];
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

function countPaths(
  startId: string,
  adjacency: Map<string, string[]>,
  endIds: Set<string>,
  bound: number,
): { count: number; exceeded: boolean; maxDepth: number } {
  let count = 0;
  let maxDepth = 0;

  function dfs(nodeId: string, depth: number, visited: Set<string>): void {
    if (count > bound) return;
    maxDepth = Math.max(maxDepth, depth);
    if (endIds.has(nodeId)) {
      count += 1;
      return;
    }
    if (depth >= MAX_GRAPH_DEPTH) return;

    for (const nextId of adjacency.get(nodeId) ?? []) {
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      dfs(nextId, depth + 1, visited);
      visited.delete(nextId);
    }
  }

  dfs(startId, 0, new Set([startId]));
  return { count, exceeded: count > bound, maxDepth };
}

export function validateAutomationGraph(graph: AutomationGraph): GraphValidationResult {
  const errors: string[] = [];

  if (!graph.nodes.length) {
    return { valid: false, errors: ["Graph must contain at least one node."] };
  }

  if (graph.nodes.length > MAX_GRAPH_NODES) {
    errors.push(`Graph exceeds maximum node count of ${MAX_GRAPH_NODES}.`);
  }

  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  if (nodeIds.size !== graph.nodes.length) {
    errors.push("Duplicate node identifiers are not allowed.");
  }

  for (const node of graph.nodes) {
    if (!NODE_TYPES.includes(node.type)) {
      errors.push(`Unknown node type on node ${node.id}.`);
    }
  }

  const triggerNodes = graph.nodes.filter((n) => n.type === "TRIGGER");
  if (triggerNodes.length !== 1) {
    errors.push("Graph must contain exactly one TRIGGER node.");
  }

  const endNodes = graph.nodes.filter((n) => n.type === "END");
  if (endNodes.length === 0) {
    errors.push("Graph must contain at least one END node.");
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push(`Edge ${edge.id} references unknown source node ${edge.sourceNodeId}.`);
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push(`Edge ${edge.id} references unknown target node ${edge.targetNodeId}.`);
    }
  }

  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.sourceNodeId);
    connected.add(edge.targetNodeId);
  }

  const triggerId = triggerNodes[0]?.id;
  if (triggerId) connected.add(triggerId);

  for (const node of graph.nodes) {
    if (node.type === "TRIGGER") continue;
    if (!connected.has(node.id)) {
      errors.push(`Orphan node detected: ${node.id}.`);
    }
  }

  if (triggerId) {
    const adjacency = buildAdjacency(graph);
    const endIds = new Set(endNodes.map((n) => n.id));
    const { count, exceeded, maxDepth } = countPaths(triggerId, adjacency, endIds, MAX_PATH_COUNT);
    if (exceeded) {
      errors.push(`Graph exceeds maximum path count of ${MAX_PATH_COUNT}.`);
    }
    if (count === 0 && endNodes.length > 0) {
      errors.push("No path exists from TRIGGER to any END node.");
    }
    if (maxDepth > MAX_GRAPH_DEPTH) {
      errors.push(`Graph exceeds maximum depth of ${MAX_GRAPH_DEPTH}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}
