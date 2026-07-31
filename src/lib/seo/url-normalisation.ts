import { TRACKING_QUERY_PARAMS, URL_NORMALISATION_VERSION } from "@/lib/seo/constants";

export type NormaliseOptions = {
  stripFragment?: boolean;
  stripTrackingParams?: boolean;
  trailingSlashPolicy?: "preserve" | "remove" | "add";
  lowercaseHost?: boolean;
  version?: number;
};

const DEFAULT_OPTIONS: Required<NormaliseOptions> = {
  stripFragment: true,
  stripTrackingParams: true,
  trailingSlashPolicy: "remove",
  lowercaseHost: true,
  version: URL_NORMALISATION_VERSION,
};

function decodePath(path: string): string {
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function normalisePath(path: string): string {
  let result = decodePath(path);
  result = result.replace(/\/+/g, "/");
  if (result.length > 1 && result.endsWith("/")) {
    result = result.slice(0, -1);
  }
  return result || "/";
}

function normaliseQuery(
  searchParams: URLSearchParams,
  stripTracking: boolean,
): string {
  const entries: Array<[string, string]> = [];
  searchParams.forEach((value, key) => {
    if (stripTracking && TRACKING_QUERY_PARAMS.includes(key.toLowerCase())) return;
    entries.push([key, value]);
  });
  entries.sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return "";
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    params.append(key, value);
  }
  return `?${params.toString()}`;
}

export type NormalisedUrl = {
  original: string;
  normalised: string;
  hostname: string;
  path: string;
  version: number;
  uncertain: boolean;
};

export function normaliseUrl(raw: string, options: NormaliseOptions = {}): NormalisedUrl {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let uncertain = false;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    uncertain = true;
    return {
      original: raw,
      normalised: raw,
      hostname: "",
      path: "",
      version: opts.version,
      uncertain: true,
    };
  }

  const protocol = parsed.protocol.toLowerCase();
  let hostname = parsed.hostname;
  if (opts.lowercaseHost) hostname = hostname.toLowerCase();

  let port = "";
  const defaultPort = protocol === "https:" ? "443" : protocol === "http:" ? "80" : "";
  if (parsed.port && parsed.port !== defaultPort) {
    port = `:${parsed.port}`;
  }

  let path = normalisePath(parsed.pathname);
  if (opts.trailingSlashPolicy === "add" && path === "/") {
    // root stays /
  } else if (opts.trailingSlashPolicy === "add" && !path.endsWith("/")) {
    path = `${path}/`;
  } else if (opts.trailingSlashPolicy === "remove" && path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  const query = normaliseQuery(parsed.searchParams, opts.stripTrackingParams);
  const fragment = opts.stripFragment ? "" : parsed.hash;

  const normalised = `${protocol}//${hostname}${port}${path}${query}${fragment}`;

  return {
    original: raw,
    normalised,
    hostname,
    path,
    version: opts.version,
    uncertain,
  };
}

export function resolveRelativeUrl(base: string, relative: string): string | null {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

export function urlsEquivalent(a: string, b: string): boolean {
  const na = normaliseUrl(a);
  const nb = normaliseUrl(b);
  if (na.uncertain || nb.uncertain) return false;
  return na.normalised === nb.normalised;
}
