import { buildEvidence } from "@/lib/on-page/evidence";

export type ReadabilityInput = {
  bodyText: string;
  headings?: Array<{ level: number; text: string }>;
};

export type ReadabilityReport = {
  sentenceLength: { avg: number; longSentences: number };
  paragraphLength: { avg: number; longParagraphs: number };
  headingFrequency: { count: number; avgWordsBetween: number };
  passiveLanguageSignal: { count: number; ratio: number };
  jargonDensity: { count: number; terms: string[] };
  unexplainedAbbreviations: string[];
  indicators: string[];
  evidence: ReturnType<typeof buildEvidence>[];
  note: string;
};

const PASSIVE_PATTERNS = /\b(is|are|was|were|been|being)\s+\w+ed\b/gi;
const JARGON_TERMS = ["synergy", "leverage", "paradigm", "holistic", "disruptive", "best-in-class"];
const ABBREV_PATTERN = /\b[A-Z]{2,6}\b/g;

export function buildReadabilityReport(input: ReadabilityInput): ReadabilityReport {
  const text = input.bodyText.trim();
  const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 0);
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);
  const avgSentenceLength = sentenceLengths.length > 0
    ? sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length
    : 0;
  const longSentences = sentenceLengths.filter((l) => l > 25).length;

  const paragraphLengths = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const avgParagraphLength = paragraphLengths.length > 0
    ? paragraphLengths.reduce((a, b) => a + b, 0) / paragraphLengths.length
    : 0;
  const longParagraphs = paragraphLengths.filter((l) => l > 150).length;

  const headingCount = input.headings?.length ?? 0;
  const avgWordsBetween = headingCount > 0 ? wordCount / headingCount : wordCount;

  const passiveMatches = text.match(PASSIVE_PATTERNS) ?? [];
  const passiveRatio = sentences.length > 0 ? passiveMatches.length / sentences.length : 0;

  const jargonFound = JARGON_TERMS.filter((t) => text.toLowerCase().includes(t));
  const abbrevMatches = [...new Set((text.match(ABBREV_PATTERN) ?? []).filter((a) => a.length >= 3))];
  const explained = abbrevMatches.filter((abbr) => {
    const expanded = text.includes(`(${abbr})`) || text.includes(`${abbr} (`);
    return !expanded;
  });

  const indicators: string[] = [];
  if (avgSentenceLength > 25) indicators.push("Average sentence length is high — consider shorter sentences.");
  if (longParagraphs > 0) indicators.push(`${longParagraphs} paragraph(s) exceed 150 words.`);
  if (passiveRatio > 0.2) indicators.push("Elevated passive voice detected.");
  if (jargonFound.length > 0) indicators.push(`Jargon terms detected: ${jargonFound.join(", ")}`);
  if (explained.length > 0) indicators.push(`Unexplained abbreviations: ${explained.join(", ")}`);
  if (indicators.length === 0) indicators.push("Readability indicators within typical ranges.");

  return {
    sentenceLength: { avg: Math.round(avgSentenceLength * 10) / 10, longSentences },
    paragraphLength: { avg: Math.round(avgParagraphLength), longParagraphs },
    headingFrequency: { count: headingCount, avgWordsBetween: Math.round(avgWordsBetween) },
    passiveLanguageSignal: { count: passiveMatches.length, ratio: Math.round(passiveRatio * 100) / 100 },
    jargonDensity: { count: jargonFound.length, terms: jargonFound },
    unexplainedAbbreviations: explained,
    indicators,
    evidence: [
      buildEvidence("readability", "avgSentenceLength", avgSentenceLength),
      buildEvidence("readability", "wordCount", wordCount),
      buildEvidence("readability", "headingCount", headingCount),
    ],
    note: "Readability indicators are transparent and advisory — no single formula is treated as universally correct.",
  };
}
