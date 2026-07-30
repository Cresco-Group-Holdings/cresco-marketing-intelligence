import { recommendInternalLinks } from "@/lib/briefs/internal-links";

export type LinkRecommendation = {
  sourceNodeId: string;
  targetNodeId: string;
  sourceUrl: string;
  targetUrl: string;
  suggestedAnchorConcept: string;
  contextualReason: string;
  confidence: number;
  evidence: Record<string, unknown>;
  potentialConflict?: string;
};

export function generateLinkRecommendations(input: {
  nodes: Array<{
    id: string;
    url: string;
    title?: string;
    topics?: string[];
    incomingCount: number;
    outgoingCount?: number;
    clusterId?: string;
    isOrphan?: boolean;
    isNearOrphan?: boolean;
  }>;
  clusterTopics?: Map<string, string[]>;
  keywordByPage?: Map<string, string>;
  existingEdges: Set<string>;
}): LinkRecommendation[] {
  const recommendations: LinkRecommendation[] = [];
  const weakPages = input.nodes.filter((n) => n.isOrphan || n.isNearOrphan || n.incomingCount < 2);

  for (const target of weakPages) {
    const topics = input.clusterTopics?.get(target.clusterId ?? "") ?? target.topics ?? [];
    const candidates = input.nodes.filter((n) => n.id !== target.id && n.incomingCount >= 2);

    const suggestions = recommendInternalLinks({
      targetPage: { id: target.id, url: target.url, title: target.title, topics },
      relatedPages: candidates.map((n) => ({
        id: n.id,
        url: n.url,
        title: n.title,
        topics: input.clusterTopics?.get(n.clusterId ?? "") ?? n.topics,
      })),
      clusterTopics: topics,
      primaryKeyword: input.keywordByPage?.get(target.id),
    });

    for (const s of suggestions) {
      if (!s.sourcePageId || !s.destinationPageId) continue;
      const edgeKey = `${s.sourceUrl}->${s.destinationUrl}`;
      if (input.existingEdges.has(edgeKey)) continue;

      const source = input.nodes.find((n) => n.id === s.sourcePageId);
      const conflict = source && (source.outgoingCount ?? 0) > 50
        ? "Source page already has many outgoing links"
        : undefined;

      recommendations.push({
        sourceNodeId: s.sourcePageId,
        targetNodeId: s.destinationPageId,
        sourceUrl: s.sourceUrl ?? "",
        targetUrl: s.destinationUrl ?? "",
        suggestedAnchorConcept: s.suggestedAnchorConcept,
        contextualReason: s.reason,
        confidence: s.confidence,
        evidence: {
          sourceUrl: s.sourceUrl,
          targetUrl: s.destinationUrl,
          topicOverlap: topics,
          targetIncomingCount: target.incomingCount,
        },
        potentialConflict: conflict,
      });
    }
  }

  return recommendations
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 50);
}
