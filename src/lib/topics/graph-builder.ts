import { CLUSTER_GRAPH_MAX_NODES } from "@/lib/topics/constants";

export type GraphNode = {
  id: string;
  type: "cluster" | "pillar" | "supporting" | "page" | "gap" | "keyword";
  label: string;
  status?: string;
  exists?: boolean;
};

export type GraphEdge = {
  source: string;
  target: string;
  type: "pillar_supporting" | "cluster_member" | "internal_link" | "gap";
};

export type ClusterGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
};

export function buildClusterGraph(input: {
  clusters: Array<{ id: string; name: string; status: string }>;
  pillars: Array<{ id: string; clusterId: string; title: string; existingPageId?: string | null }>;
  supporting: Array<{ id: string; clusterId: string; pillarPageId?: string | null; title: string; existingPageId?: string | null }>;
  keywords: Array<{ id: string; clusterId: string; label: string }>;
  gaps: Array<{ id: string; clusterId?: string | null; title: string }>;
  internalLinks?: Array<{ sourceId: string; targetId: string }>;
}): ClusterGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const cluster of input.clusters) {
    nodes.push({ id: `cluster:${cluster.id}`, type: "cluster", label: cluster.name, status: cluster.status });
  }

  for (const pillar of input.pillars) {
    nodes.push({
      id: `pillar:${pillar.id}`,
      type: "pillar",
      label: pillar.title,
      exists: !!pillar.existingPageId,
    });
    edges.push({ source: `cluster:${pillar.clusterId}`, target: `pillar:${pillar.id}`, type: "cluster_member" });
  }

  for (const page of input.supporting) {
    nodes.push({
      id: `supporting:${page.id}`,
      type: "supporting",
      label: page.title,
      exists: !!page.existingPageId,
    });
    edges.push({ source: `cluster:${page.clusterId}`, target: `supporting:${page.id}`, type: "cluster_member" });
    if (page.pillarPageId) {
      edges.push({ source: `pillar:${page.pillarPageId}`, target: `supporting:${page.id}`, type: "pillar_supporting" });
    }
  }

  for (const kw of input.keywords) {
    nodes.push({ id: `keyword:${kw.id}`, type: "keyword", label: kw.label });
    edges.push({ source: `cluster:${kw.clusterId}`, target: `keyword:${kw.id}`, type: "cluster_member" });
  }

  for (const gap of input.gaps) {
    nodes.push({ id: `gap:${gap.id}`, type: "gap", label: gap.title, exists: false });
    if (gap.clusterId) {
      edges.push({ source: `cluster:${gap.clusterId}`, target: `gap:${gap.id}`, type: "gap" });
    }
  }

  for (const link of input.internalLinks ?? []) {
    edges.push({ source: link.sourceId, target: link.targetId, type: "internal_link" });
  }

  const truncated = nodes.length > CLUSTER_GRAPH_MAX_NODES;
  return {
    nodes: truncated ? nodes.slice(0, CLUSTER_GRAPH_MAX_NODES) : nodes,
    edges: truncated ? edges.filter((e) => {
      const ids = new Set(nodes.slice(0, CLUSTER_GRAPH_MAX_NODES).map((n) => n.id));
      return ids.has(e.source) && ids.has(e.target);
    }) : edges,
    truncated,
  };
}
