import { KEYWORD_NORMALISATION_VERSION } from "@/lib/keywords/constants";

export type NormaliseKeywordOptions = {
  language?: string;
  country?: string;
  locale?: string;
  version?: number;
};

export type NormalisedKeyword = {
  original: string;
  normalised: string;
  display: string;
  language: string;
  country?: string;
  locale?: string;
  version: number;
};

function normaliseUnicode(text: string): string {
  return text.normalize("NFC");
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function normalisePunctuation(text: string): string {
  return text
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/…/g, "...")
    .replace(/\u00A0/g, " ");
}

/**
 * Deterministic keyword normalisation. Preserves phrase order, spelling,
 * and singular/plural forms. Does not merge semantically related queries.
 */
export function normaliseKeyword(
  raw: string,
  options: NormaliseKeywordOptions = {},
): NormalisedKeyword {
  const version = options.version ?? KEYWORD_NORMALISATION_VERSION;
  let text = normaliseUnicode(raw);
  text = normalisePunctuation(text);
  text = collapseWhitespace(text);

  const display = text;
  const normalised = text.toLowerCase();

  return {
    original: raw,
    normalised,
    display,
    language: options.language ?? "en",
    country: options.country,
    locale: options.locale,
    version,
  };
}

export function keywordIdentityKey(
  normalised: string,
  language: string,
  country?: string | null,
): string {
  return `${normalised}::${language}::${country ?? "*"}`;
}

export function keywordsEquivalent(
  a: string,
  b: string,
  language = "en",
  country?: string | null,
): boolean {
  const na = normaliseKeyword(a, { language, country: country ?? undefined });
  const nb = normaliseKeyword(b, { language, country: country ?? undefined });
  return (
    na.normalised === nb.normalised &&
    na.language === nb.language &&
    (na.country ?? null) === (nb.country ?? null)
  );
}
