export type RecentContentSnippet = {
  id: string;
  title: string;
  hook: string | null;
  publishedAt: string;
  contentPillar: string | null;
  channel: string | null;
};

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = new Set(normalise(a).split(" ").filter((t) => t.length > 3));
  const tokensB = new Set(normalise(b).split(" ").filter((t) => t.length > 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }
  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function detectContentDuplication(
  candidate: { title: string; hook?: string | null; body: string; contentPillar?: string | null },
  recent: RecentContentSnippet[],
  options?: { sameChannel?: string | null; threshold?: number },
): string | null {
  const threshold = options?.threshold ?? 0.55;
  const candidateText = [candidate.title, candidate.hook, candidate.body].filter(Boolean).join(" ");

  for (const item of recent) {
    if (options?.sameChannel && item.channel && item.channel !== options.sameChannel) {
      continue;
    }
    const itemText = [item.title, item.hook].filter(Boolean).join(" ");
    const similarity = tokenOverlap(candidateText, itemText);
    if (similarity >= threshold) {
      const daysAgo = Math.max(
        0,
        Math.round(
          (Date.now() - new Date(item.publishedAt).getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      return `You published a very similar message ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago: "${item.title}".`;
    }
    if (
      candidate.contentPillar &&
      item.contentPillar === candidate.contentPillar &&
      similarity >= threshold * 0.85
    ) {
      return `Similar ${candidate.contentPillar.replace(/_/g, " ")} content was published recently.`;
    }
  }

  return null;
}
