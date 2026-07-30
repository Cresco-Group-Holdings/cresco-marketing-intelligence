import { truncateExcerpt } from "@/lib/competitors/crawl-policy";

export type PageComparisonInput = {
  brandUrl?: string;
  competitorUrl?: string;
  brandTitle?: string;
  competitorTitle?: string;
  brandHeadings?: Array<{ level: number; text: string }>;
  competitorHeadings?: Array<{ level: number; text: string }>;
  brandWordCount?: number;
  competitorWordCount?: number;
  brandTopics?: string[];
  competitorTopics?: string[];
  brandStructuredData?: string[];
  competitorStructuredData?: string[];
  brandInternalLinks?: number;
  competitorInternalLinks?: number;
  brandCtaType?: string;
  competitorCtaType?: string;
};

export type PageComparisonResult = {
  comparison: {
    outline: { brand: string[]; competitor: string[] };
    headings: { brand: string[]; competitor: string[] };
    topics: { brandOnly: string[]; competitorOnly: string[]; shared: string[] };
    structuredData: { brand: string[]; competitor: string[] };
    depth: { brandWordCount: number | null; competitorWordCount: number | null };
    internalLinks: { brand: number | null; competitor: number | null };
    ctaType: { brand: string | null; competitor: string | null };
  };
  limitations: string;
};

export function comparePages(input: PageComparisonInput): PageComparisonResult {
  const brandHeadings = (input.brandHeadings ?? []).map((h) => truncateExcerpt(h.text, 100));
  const competitorHeadings = (input.competitorHeadings ?? []).map((h) => truncateExcerpt(h.text, 100));
  const brandTopics = new Set((input.brandTopics ?? []).map((t) => t.toLowerCase()));
  const competitorTopics = new Set((input.competitorTopics ?? []).map((t) => t.toLowerCase()));
  const shared = [...brandTopics].filter((t) => competitorTopics.has(t));
  const brandOnly = [...brandTopics].filter((t) => !competitorTopics.has(t));
  const competitorOnly = [...competitorTopics].filter((t) => !brandTopics.has(t));

  return {
    comparison: {
      outline: {
        brand: brandHeadings.slice(0, 10),
        competitor: competitorHeadings.slice(0, 10),
      },
      headings: { brand: brandHeadings, competitor: competitorHeadings },
      topics: { brandOnly, competitorOnly, shared },
      structuredData: {
        brand: input.brandStructuredData ?? [],
        competitor: input.competitorStructuredData ?? [],
      },
      depth: {
        brandWordCount: input.brandWordCount ?? null,
        competitorWordCount: input.competitorWordCount ?? null,
      },
      internalLinks: {
        brand: input.brandInternalLinks ?? null,
        competitor: input.competitorInternalLinks ?? null,
      },
      ctaType: {
        brand: input.brandCtaType ?? null,
        competitor: input.competitorCtaType ?? null,
      },
    },
    limitations:
      "Comparison based on publicly observable page structure only. No traffic, ranking, or private analytics data included. Substantial competitor text is not reproduced.",
  };
}
