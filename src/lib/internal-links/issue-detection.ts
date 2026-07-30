import type { InternalLinkIssueType } from "@prisma/client";
import {
  ANCHOR_REPETITION_THRESHOLD,
  EXCESSIVE_DEPTH_THRESHOLD,
  WEAK_LINK_THRESHOLD,
} from "@/lib/internal-links/constants";
import type { GraphMetrics, GraphNodeInput } from "@/lib/internal-links/graph-metrics";

export type LinkIssue = {
  issueType: InternalLinkIssueType;
  severity: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  sourceNodeId?: string;
  targetNodeId?: string;
  edgeKey?: string;
};

export function detectLinkIssues(
  nodes: GraphNodeInput[],
  metrics: GraphMetrics,
  anchorCounts: Map<string, number>,
  importantPageIds: Set<string>,
): LinkIssue[] {
  const issues: LinkIssue[] = [];
  const nodeByUrl = new Map(nodes.map((n) => [n.url, n]));

  for (const node of nodes) {
    if (node.incomingLinks.length === 0 && node.url !== nodes[0]?.url) {
      issues.push({
        issueType: "ORPHAN_PAGE",
        severity: "HIGH",
        title: "Orphan page",
        description: `${node.url} has no incoming internal links.`,
        evidence: { url: node.url, incomingCount: 0 },
        sourceNodeId: node.id,
      });
    } else if (node.incomingLinks.length === 1) {
      issues.push({
        issueType: "NEAR_ORPHAN_PAGE",
        severity: "MEDIUM",
        title: "Near-orphan page",
        description: `${node.url} has only one incoming internal link.`,
        evidence: { url: node.url, incomingCount: 1 },
        sourceNodeId: node.id,
      });
    }

    if (node.crawlDepth && node.crawlDepth > EXCESSIVE_DEPTH_THRESHOLD) {
      issues.push({
        issueType: "EXCESSIVE_CRAWL_DEPTH",
        severity: "MEDIUM",
        title: "Excessive crawl depth",
        description: `${node.url} is at depth ${node.crawlDepth} (threshold ${EXCESSIVE_DEPTH_THRESHOLD}).`,
        evidence: { url: node.url, crawlDepth: node.crawlDepth },
        sourceNodeId: node.id,
      });
    }

    if (importantPageIds.has(node.id) && node.incomingLinks.length < WEAK_LINK_THRESHOLD) {
      issues.push({
        issueType: "LOW_INTERNAL_SUPPORT",
        severity: "HIGH",
        title: "Important page with low internal support",
        description: `${node.url} is strategically important but has only ${node.incomingLinks.length} incoming links.`,
        evidence: { url: node.url, incomingCount: node.incomingLinks.length },
        sourceNodeId: node.id,
      });
    }

    for (const link of node.outgoingLinks) {
      if (link.statusCode && link.statusCode >= 400) {
        issues.push({
          issueType: "BROKEN_INTERNAL_LINK",
          severity: "HIGH",
          title: "Broken internal link",
          description: `Link from ${node.url} to ${link.targetUrl} returns ${link.statusCode}.`,
          evidence: { sourceUrl: node.url, targetUrl: link.targetUrl, statusCode: link.statusCode },
          sourceNodeId: node.id,
          edgeKey: `${node.url}->${link.targetUrl}`,
        });
      }
      if (link.isRedirect) {
        issues.push({
          issueType: "LINK_TO_REDIRECT",
          severity: "MEDIUM",
          title: "Link to redirect",
          description: `Link from ${node.url} to ${link.targetUrl} targets a redirect.`,
          evidence: { sourceUrl: node.url, targetUrl: link.targetUrl },
          sourceNodeId: node.id,
          edgeKey: `${node.url}->${link.targetUrl}`,
        });
      }
      if (link.isNoindex) {
        issues.push({
          issueType: "LINK_TO_NOINDEX",
          severity: "MEDIUM",
          title: "Link to noindex page",
          description: `Link from ${node.url} to ${link.targetUrl} targets a noindex page.`,
          evidence: { sourceUrl: node.url, targetUrl: link.targetUrl },
          sourceNodeId: node.id,
          edgeKey: `${node.url}->${link.targetUrl}`,
        });
      }
    }
  }

  for (const [anchor, count] of anchorCounts) {
    if (count >= ANCHOR_REPETITION_THRESHOLD && anchor.trim()) {
      issues.push({
        issueType: "ANCHOR_REPETITION",
        severity: "LOW",
        title: "Excessive anchor repetition",
        description: `Anchor "${anchor}" used ${count} times across the site.`,
        evidence: { anchorText: anchor, count },
      });
    }
  }

  const clusterIds = new Set(nodes.filter((n) => n.clusterId).map((n) => n.clusterId!));
  for (const clusterId of clusterIds) {
    const clusterNodes = nodes.filter((n) => n.clusterId === clusterId);
    const connected = clusterNodes.filter((n) => n.incomingLinks.length > 0 || n.outgoingLinks.length > 0);
    if (connected.length < clusterNodes.length * 0.5 && clusterNodes.length > 2) {
      issues.push({
        issueType: "DISCONNECTED_CLUSTER",
        severity: "MEDIUM",
        title: "Disconnected topic cluster",
        description: `Cluster ${clusterId} has ${clusterNodes.length - connected.length} weakly connected pages.`,
        evidence: { clusterId, totalPages: clusterNodes.length, connectedPages: connected.length },
      });
    }
  }

  if (metrics.linkConcentration > 0.5) {
    issues.push({
      issueType: "LOW_INTERNAL_SUPPORT",
      severity: "MEDIUM",
      title: "High link concentration",
      description: `Top 10% of pages receive ${Math.round(metrics.linkConcentration * 100)}% of internal links.`,
      evidence: { linkConcentration: metrics.linkConcentration },
    });
  }

  return issues;
}
