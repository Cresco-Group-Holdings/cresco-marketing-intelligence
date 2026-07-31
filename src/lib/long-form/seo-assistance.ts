export type SeoAssistanceInput = {
  title?: string;
  metaDescription?: string;
  sections: Array<{ heading?: string | null; body: string; headingLevel?: number }>;
  briefKeywords?: string[];
  briefQuestions?: string[];
  briefHeadings?: Array<{ level: number; text: string }>;
  briefEntities?: string[];
  internalLinkConcepts?: string[];
  targetLengthMin?: number;
  targetLengthMax?: number;
};

export type SeoAssistanceReport = {
  briefCoverage: { covered: string[]; missing: string[]; score: number };
  keywordCoverage: { keyword: string; count: number; inHeadings: boolean }[];
  entityCoverage: { entity: string; present: boolean }[];
  headingStructure: { level: number; text: string; issues: string[] }[];
  internalLinks: { concept: string; suggested: boolean; present: boolean }[];
  missingQuestions: string[];
  readability: {
    wordCount: number;
    avgSentenceLength: number;
    longParagraphs: number;
    indicators: string[];
  };
  unsupportedClaims: number;
  contentLength: {
    words: number;
    targetMin?: number;
    targetMax?: number;
    status: "short" | "within" | "long" | "unknown";
  };
  notes: string[];
};

function countOccurrences(text: string, term: string): number {
  const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(regex) ?? []).length;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function buildSeoAssistanceReport(
  input: SeoAssistanceInput,
  unsupportedClaimCount = 0,
): SeoAssistanceReport {
  const fullText = [
    input.title ?? "",
    input.metaDescription ?? "",
    ...input.sections.map((s) => `${s.heading ?? ""} ${s.body}`),
  ].join(" ");

  const words = wordCount(fullText);
  const sentences = fullText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = sentences.length > 0 ? words / sentences.length : 0;

  const keywords = input.briefKeywords ?? [];
  const keywordCoverage = keywords.map((keyword) => ({
    keyword,
    count: countOccurrences(fullText, keyword),
    inHeadings: input.sections.some((s) =>
      (s.heading ?? "").toLowerCase().includes(keyword.toLowerCase()),
    ),
  }));

  const briefHeadings = input.briefHeadings ?? [];
  const presentHeadings = input.sections
    .filter((s) => s.heading)
    .map((s) => (s.heading ?? "").toLowerCase());
  const covered = briefHeadings
    .filter((h) => presentHeadings.some((ph) => ph.includes(h.text.toLowerCase().slice(0, 20))))
    .map((h) => h.text);
  const missing = briefHeadings.filter((h) => !covered.includes(h.text)).map((h) => h.text);

  const entities = input.briefEntities ?? [];
  const entityCoverage = entities.map((entity) => ({
    entity,
    present: fullText.toLowerCase().includes(entity.toLowerCase()),
  }));

  const headingStructure = input.sections
    .filter((s) => s.heading)
    .map((s) => {
      const issues: string[] = [];
      const level = s.headingLevel ?? 2;
      if (level < 1 || level > 6) issues.push("Invalid heading level");
      if ((s.heading ?? "").length > 80) issues.push("Heading may be too long for SEO");
      return { level, text: s.heading ?? "", issues };
    });

  const questions = input.briefQuestions ?? [];
  const missingQuestions = questions.filter(
    (q) => !fullText.toLowerCase().includes(q.toLowerCase().slice(0, 30)),
  );

  const linkConcepts = input.internalLinkConcepts ?? [];
  const internalLinks = linkConcepts.map((concept) => ({
    concept,
    suggested: true,
    present: fullText.toLowerCase().includes(concept.toLowerCase()),
  }));

  let lengthStatus: SeoAssistanceReport["contentLength"]["status"] = "unknown";
  if (input.targetLengthMin && words < input.targetLengthMin) lengthStatus = "short";
  else if (input.targetLengthMax && words > input.targetLengthMax) lengthStatus = "long";
  else if (input.targetLengthMin || input.targetLengthMax) lengthStatus = "within";

  const longParagraphs = input.sections.filter((s) => wordCount(s.body) > 150).length;

  const notes: string[] = [
    "SEO indicators are advisory — not a single absolute score.",
    "Review keyword coverage in context of natural language.",
  ];
  if (missing.length > 0) notes.push(`${missing.length} brief heading(s) not yet covered.`);
  if (missingQuestions.length > 0) notes.push(`${missingQuestions.length} brief question(s) unanswered.`);

  return {
    briefCoverage: {
      covered,
      missing,
      score: briefHeadings.length > 0 ? covered.length / briefHeadings.length : 1,
    },
    keywordCoverage,
    entityCoverage,
    headingStructure,
    internalLinks,
    missingQuestions,
    readability: {
      wordCount: words,
      avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
      longParagraphs,
      indicators: [
        avgSentenceLength > 25 ? "Consider shorter sentences" : "Sentence length acceptable",
        longParagraphs > 0 ? `${longParagraphs} long paragraph(s)` : "Paragraph length acceptable",
      ],
    },
    unsupportedClaims: unsupportedClaimCount,
    contentLength: {
      words,
      targetMin: input.targetLengthMin,
      targetMax: input.targetLengthMax,
      status: lengthStatus,
    },
    notes,
  };
}
