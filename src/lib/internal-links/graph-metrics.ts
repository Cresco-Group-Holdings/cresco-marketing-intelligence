export type GraphNodeInput = {
  id: string;
  url: string;
  title?: string;
  crawlDepth?: number;
  isIndexable?: boolean;
  clusterId?: string;
  incomingLinks: string[];
  outgoingLinks: Array<{ targetUrl: string; anchorText?: string; statusCode?: number; isRedirect?: boolean; isNoindex?: boolean }>;
};

export type GraphMetrics = {
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  nearOrphanCount: number;
  avgIncomingLinks: number;
  avgOutgoingLinks: number;
  maxCrawlDepth: number;
  brokenLinkCount: number;
  redirectLinkCount: number;
  noindexTargetCount: number;
  linkConcentration: number;
  topicalConnectionAvg: number;
};

export function calculateNodeMetrics(node: GraphNodeInput): {
  incomingCount: number;
  outgoingCount: number;
  isOrphan: boolean;
  isNearOrphan: boolean;
  topicalConnections: number;
} {
  const incomingCount = node.incomingLinks.length;
  const outgoingCount = node.outgoingLinks.length;
  return {
    incomingCount,
    outgoingCount,
    isOrphan: incomingCount === 0,
    isNearOrphan: incomingCount === 1,
    topicalConnections: node.clusterId ? incomingCount + outgoingCount : 0,
  };
}

export function calculateGraphMetrics(nodes: GraphNodeInput[]): GraphMetrics {
  const nodeCount = nodes.length;
  if (nodeCount === 0) {
    return {
      nodeCount: 0, edgeCount: 0, orphanCount: 0, nearOrphanCount: 0,
      avgIncomingLinks: 0, avgOutgoingLinks: 0, maxCrawlDepth: 0,
      brokenLinkCount: 0, redirectLinkCount: 0, noindexTargetCount: 0,
      linkConcentration: 0, topicalConnectionAvg: 0,
    };
  }

  let edgeCount = 0;
  let orphanCount = 0;
  let nearOrphanCount = 0;
  let totalIncoming = 0;
  let totalOutgoing = 0;
  let maxCrawlDepth = 0;
  let brokenLinkCount = 0;
  let redirectLinkCount = 0;
  let noindexTargetCount = 0;
  let topicalTotal = 0;

  const incomingDistribution: number[] = [];

  for (const node of nodes) {
    const m = calculateNodeMetrics(node);
    totalIncoming += m.incomingCount;
    totalOutgoing += m.outgoingCount;
    if (m.isOrphan) orphanCount++;
    if (m.isNearOrphan) nearOrphanCount++;
    topicalTotal += m.topicalConnections;
    incomingDistribution.push(m.incomingCount);
    if (node.crawlDepth && node.crawlDepth > maxCrawlDepth) maxCrawlDepth = node.crawlDepth;

    for (const link of node.outgoingLinks) {
      edgeCount++;
      if (link.statusCode && link.statusCode >= 400) brokenLinkCount++;
      if (link.isRedirect) redirectLinkCount++;
      if (link.isNoindex) noindexTargetCount++;
    }
  }

  const sorted = [...incomingDistribution].sort((a, b) => b - a);
  const top10Pct = Math.max(1, Math.ceil(nodeCount * 0.1));
  const top10Sum = sorted.slice(0, top10Pct).reduce((a, b) => a + b, 0);
  const linkConcentration = totalIncoming > 0 ? top10Sum / totalIncoming : 0;

  return {
    nodeCount,
    edgeCount,
    orphanCount,
    nearOrphanCount,
    avgIncomingLinks: Math.round((totalIncoming / nodeCount) * 10) / 10,
    avgOutgoingLinks: Math.round((totalOutgoing / nodeCount) * 10) / 10,
    maxCrawlDepth,
    brokenLinkCount,
    redirectLinkCount,
    noindexTargetCount,
    linkConcentration: Math.round(linkConcentration * 100) / 100,
    topicalConnectionAvg: Math.round((topicalTotal / nodeCount) * 10) / 10,
  };
}

export function sampleNodesForVisualization<T extends { id: string }>(
  nodes: T[],
  limit = 500,
): { sampled: T[]; total: number; truncated: boolean } {
  if (nodes.length <= limit) {
    return { sampled: nodes, total: nodes.length, truncated: false };
  }
  const step = Math.ceil(nodes.length / limit);
  const sampled = nodes.filter((_, i) => i % step === 0).slice(0, limit);
  return { sampled, total: nodes.length, truncated: true };
}

export function computeCrawlDepths(
  nodes: Array<{ id: string; url: string }>,
  edges: Array<{ sourceId: string; targetId: string }>,
  rootUrl: string,
): Map<string, number> {
  const depths = new Map<string, number>();
  const root = nodes.find((n) => n.url === rootUrl || n.url.endsWith("/"));
  if (!root) return depths;

  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const list = adjacency.get(e.sourceId) ?? [];
    list.push(e.targetId);
    adjacency.set(e.sourceId, list);
  }

  const queue: Array<{ id: string; depth: number }> = [{ id: root.id, depth: 0 }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    depths.set(id, depth);
    for (const child of adjacency.get(id) ?? []) {
      if (!visited.has(child)) queue.push({ id: child, depth: depth + 1 });
    }
  }

  return depths;
}
