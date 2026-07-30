import type { SeoCannibalisationStatus } from "@prisma/client";
import { KEYWORD_CANNIBALISATION_MIN_PAGES } from "@/lib/keywords/constants";

export type CannibalisationCandidate = {
  keyword: string;
  status: SeoCannibalisationStatus;
  pages: Array<{ url: string; title?: string; position?: number }>;
  evidence: Record<string, unknown>;
  explanation: string;
};

export type PageRanking = {
  url: string;
  title?: string;
  headings?: string[];
  position?: number;
  isExplicitTarget?: boolean;
};

export function detectCannibalisation(
  keyword: string,
  pages: PageRanking[],
): CannibalisationCandidate | null {
  if (pages.length < KEYWORD_CANNIBALISATION_MIN_PAGES) return null;

  const rankingPages = pages.filter((p) => p.position != null && p.position <= 50);
  const explicitTargets = pages.filter((p) => p.isExplicitTarget);
  const titlesOverlap = hasTitleOverlap(pages);

  const evidence: Record<string, unknown> = {
    pageCount: pages.length,
    rankingPageCount: rankingPages.length,
    explicitTargetCount: explicitTargets.length,
    titlesOverlap,
    pages: pages.map((p) => ({ url: p.url, position: p.position, isExplicitTarget: p.isExplicitTarget })),
  };

  if (explicitTargets.length >= 2) {
    return {
      keyword,
      status: "LIKELY",
      pages,
      evidence,
      explanation: `Multiple pages (${explicitTargets.length}) explicitly target "${keyword}".`,
    };
  }

  if (rankingPages.length >= 2 && titlesOverlap) {
    return {
      keyword,
      status: "POSSIBLE",
      pages: rankingPages,
      evidence,
      explanation: `${rankingPages.length} pages rank for "${keyword}" with overlapping titles/headings.`,
    };
  }

  if (rankingPages.length >= 2) {
    return {
      keyword,
      status: "POSSIBLE",
      pages: rankingPages,
      evidence,
      explanation: `${rankingPages.length} pages rank for "${keyword}".`,
    };
  }

  return null;
}

function hasTitleOverlap(pages: PageRanking[]): boolean {
  const titles = pages.map((p) => p.title?.toLowerCase().trim()).filter(Boolean) as string[];
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      if (titlesOverlap(titles[i]!, titles[j]!)) return true;
    }
  }
  return false;
}

function titlesOverlap(a: string, b: string): boolean {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 3));
  const wordsB = b.split(/\s+/).filter((w) => w.length > 3);
  const shared = wordsB.filter((w) => wordsA.has(w));
  return shared.length >= 2;
}
