export type PageGraphNode = {
  id: string;
  url: string;
  title?: string;
  topics?: string[];
};

export type InternalLinkSuggestion = {
  sourcePageId?: string;
  destinationPageId?: string;
  sourceUrl?: string;
  destinationUrl?: string;
  suggestedAnchorConcept: string;
  reason: string;
  confidence: number;
};

export function recommendInternalLinks(input: {
  targetPage?: PageGraphNode;
  relatedPages: PageGraphNode[];
  clusterTopics?: string[];
  primaryKeyword?: string;
}): InternalLinkSuggestion[] {
  const suggestions: InternalLinkSuggestion[] = [];
  const topics = new Set((input.clusterTopics ?? []).map((t) => t.toLowerCase()));
  const keyword = input.primaryKeyword?.toLowerCase();

  for (const page of input.relatedPages) {
    if (input.targetPage && page.id === input.targetPage.id) continue;

    const pageTopics = (page.topics ?? []).map((t) => t.toLowerCase());
    const topicOverlap = pageTopics.filter((t) => topics.has(t));
    const urlMatch = keyword && page.url.toLowerCase().includes(keyword.replace(/\s+/g, "-"));

    if (topicOverlap.length > 0 || urlMatch) {
      suggestions.push({
        destinationPageId: page.id,
        destinationUrl: page.url,
        sourcePageId: input.targetPage?.id,
        sourceUrl: input.targetPage?.url,
        suggestedAnchorConcept: topicOverlap[0] ?? input.primaryKeyword ?? page.title ?? "related topic",
        reason: topicOverlap.length > 0
          ? `Shared topic coverage: ${topicOverlap.slice(0, 3).join(", ")}`
          : "URL/topic relevance to primary keyword",
        confidence: topicOverlap.length > 0 ? Math.min(0.9, 0.5 + topicOverlap.length * 0.1) : 0.4,
      });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}
