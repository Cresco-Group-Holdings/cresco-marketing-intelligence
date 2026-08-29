/**
 * Canonical UTM governance for Content Studio, Publishing, and attribution lineage.
 */

export type UtmParams = {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content?: string;
  utm_term?: string;
};

export type UtmLineageInput = {
  contentItemId?: string;
  contentVariantId?: string;
  publicationId?: string;
  campaignName?: string;
  channel?: string;
};

export type BuiltUtm = UtmParams & {
  /** Human-readable label for UI — never exposes raw internal IDs as campaign names. */
  displayCampaign: string;
  lineage: UtmLineageInput;
};

const UTM_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,98}[a-z0-9]$/i;

function slugify(value: string, maxLength = 64): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
  return slug || "content";
}

function assertValidUtmValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} is required.`);
  }
  if (trimmed.length > 100) {
    throw new Error(`${field} must be 100 characters or fewer.`);
  }
  if (!UTM_KEY_PATTERN.test(trimmed)) {
    throw new Error(`${field} contains invalid characters.`);
  }
  return trimmed;
}

/** Builds canonical UTM parameters from content/campaign context. */
export function buildContentUtm(input: {
  source: string;
  medium: string;
  campaignLabel: string;
  contentLabel?: string;
  term?: string;
  lineage?: UtmLineageInput;
}): BuiltUtm {
  const utm_source = assertValidUtmValue(slugify(input.source, 32), "utm_source");
  const utm_medium = assertValidUtmValue(slugify(input.medium, 32), "utm_medium");
  const displayCampaign = input.campaignLabel.trim().slice(0, 80) || "campaign";
  const utm_campaign = assertValidUtmValue(slugify(displayCampaign, 48), "utm_campaign");

  const params: BuiltUtm = {
    utm_source,
    utm_medium,
    utm_campaign,
    displayCampaign,
    lineage: input.lineage ?? {},
  };

  if (input.contentLabel) {
    params.utm_content = assertValidUtmValue(slugify(input.contentLabel, 48), "utm_content");
  }
  if (input.term) {
    params.utm_term = assertValidUtmValue(slugify(input.term, 48), "utm_term");
  }

  return params;
}

/** Appends UTM query string to a destination URL. */
export function appendUtmToUrl(baseUrl: string, utm: UtmParams): string {
  const url = new URL(baseUrl, "https://placeholder.local");
  for (const [key, value] of Object.entries(utm)) {
    if (value) url.searchParams.set(key, value);
  }
  if (baseUrl.startsWith("http://") || baseUrl.startsWith("https://")) {
    const resolved = new URL(baseUrl);
    for (const [key, value] of Object.entries(utm)) {
      if (value) resolved.searchParams.set(key, value);
    }
    return resolved.toString();
  }
  return `${url.pathname}${url.search}`;
}

export type ParsedUtm = Partial<UtmParams> & {
  isDirect: boolean;
  isUnknown: boolean;
};

/** Parses UTM parameters from a session or URL search string. */
export function parseUtmParams(
  input: Partial<Record<keyof UtmParams, string | null | undefined>>,
): ParsedUtm {
  const utm_source = input.utm_source?.trim() || undefined;
  const utm_medium = input.utm_medium?.trim() || undefined;
  const utm_campaign = input.utm_campaign?.trim() || undefined;
  const utm_content = input.utm_content?.trim() || undefined;
  const utm_term = input.utm_term?.trim() || undefined;

  const hasAny = Boolean(utm_source || utm_medium || utm_campaign || utm_content || utm_term);
  const isDirect =
    !hasAny ||
    (utm_medium?.toLowerCase() === "direct" && !utm_source) ||
    utm_source?.toLowerCase() === "(direct)";

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_content,
    utm_term,
    isDirect,
    isUnknown: !hasAny && !isDirect,
  };
}

/** Resolves content lineage key used in attribution touchpoints (utm_content). */
export function resolveContentLineageKey(utm: ParsedUtm, fallbackContentId?: string): string | null {
  if (utm.utm_content) return utm.utm_content;
  if (fallbackContentId) return fallbackContentId;
  return null;
}
