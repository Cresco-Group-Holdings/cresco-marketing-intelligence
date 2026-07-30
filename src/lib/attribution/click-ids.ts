export type ClickIdProvider = "google" | "meta" | "linkedin" | "tiktok" | "internal";

export type ParsedClickId = {
  provider: ClickIdProvider;
  clickId: string;
  paramName: string;
};

const CLICK_ID_PARAMS: Array<{ param: string; provider: ClickIdProvider }> = [
  { param: "gclid", provider: "google" },
  { param: "gbraid", provider: "google" },
  { param: "wbraid", provider: "google" },
  { param: "fbclid", provider: "meta" },
  { param: "li_fat_id", provider: "linkedin" },
  { param: "ttclid", provider: "tiktok" },
  { param: "cresco_cid", provider: "internal" },
];

export function parseClickIds(
  params: Record<string, string | undefined | null>,
): ParsedClickId | null {
  for (const { param, provider } of CLICK_ID_PARAMS) {
    const value = params[param]?.trim();
    if (value) {
      return { provider, clickId: value, paramName: param };
    }
  }
  return null;
}

export function extractClickIdFromUrl(url: string): ParsedClickId | null {
  try {
    const parsed = new URL(url);
    const params: Record<string, string> = {};
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return parseClickIds(params);
  } catch {
    return null;
  }
}

export function isPermittedClickIdUsage(purpose: "attribution" | "reporting"): boolean {
  return purpose === "attribution" || purpose === "reporting";
}
