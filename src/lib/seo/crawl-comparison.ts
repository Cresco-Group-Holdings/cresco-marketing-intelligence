export type SnapshotSummary = {
  pageId: string;
  normalisedUrl: string;
  statusCode: number | null;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  robotsDirective: string | null;
  contentHash: string | null;
};

export type CrawlComparison = {
  newPages: string[];
  removedPages: string[];
  statusCodeChanges: Array<{ url: string; from: number | null; to: number | null }>;
  titleChanges: Array<{ url: string; from: string | null; to: string | null }>;
  descriptionChanges: Array<{ url: string; from: string | null; to: string | null }>;
  canonicalChanges: Array<{ url: string; from: string | null; to: string | null }>;
  robotsChanges: Array<{ url: string; from: string | null; to: string | null }>;
  issueDelta: { added: number; resolved: number; net: number };
};

export function compareCrawlRuns(
  baseline: SnapshotSummary[],
  current: SnapshotSummary[],
  baselineIssueCount: number,
  currentIssueCount: number,
): CrawlComparison {
  const baseMap = new Map(baseline.map((s) => [s.normalisedUrl, s]));
  const currMap = new Map(current.map((s) => [s.normalisedUrl, s]));

  const newPages: string[] = [];
  const removedPages: string[] = [];
  const statusCodeChanges: CrawlComparison["statusCodeChanges"] = [];
  const titleChanges: CrawlComparison["titleChanges"] = [];
  const descriptionChanges: CrawlComparison["descriptionChanges"] = [];
  const canonicalChanges: CrawlComparison["canonicalChanges"] = [];
  const robotsChanges: CrawlComparison["robotsChanges"] = [];

  for (const url of currMap.keys()) {
    if (!baseMap.has(url)) newPages.push(url);
  }
  for (const url of baseMap.keys()) {
    if (!currMap.has(url)) removedPages.push(url);
  }

  for (const [url, curr] of currMap) {
    const base = baseMap.get(url);
    if (!base) continue;
    if (base.statusCode !== curr.statusCode) {
      statusCodeChanges.push({ url, from: base.statusCode, to: curr.statusCode });
    }
    if (base.title !== curr.title) {
      titleChanges.push({ url, from: base.title, to: curr.title });
    }
    if (base.description !== curr.description) {
      descriptionChanges.push({ url, from: base.description, to: curr.description });
    }
    if (base.canonicalUrl !== curr.canonicalUrl) {
      canonicalChanges.push({ url, from: base.canonicalUrl, to: curr.canonicalUrl });
    }
    if (base.robotsDirective !== curr.robotsDirective) {
      robotsChanges.push({ url, from: base.robotsDirective, to: curr.robotsDirective });
    }
  }

  const net = currentIssueCount - baselineIssueCount;
  return {
    newPages,
    removedPages,
    statusCodeChanges,
    titleChanges,
    descriptionChanges,
    canonicalChanges,
    robotsChanges,
    issueDelta: {
      added: net > 0 ? net : 0,
      resolved: net < 0 ? -net : 0,
      net,
    },
  };
}
