import { AppError } from "@/lib/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost"];

const PRIVATE_IPV4_RANGES: Array<[number, number]> = [
  [0x7f000000, 0x7fffffff], // 127.0.0.0/8 loopback
  [0x0a000000, 0x0affffff], // 10.0.0.0/8
  [0xac100000, 0xac1fffff], // 172.16.0.0/12
  [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
  [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16 link-local
  [0x64400000, 0x647fffff], // 100.64.0.0/10 CGNAT
  [0x00000000, 0x00ffffff], // 0.0.0.0/8
];

const METADATA_IPV4 = new Set(["169.254.169.254", "169.254.170.2"]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_PORTS = new Set([
  22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 11211, 27017, 9200,
]);

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = (value << 8) + n;
  }
  return value >>> 0;
}

function isPrivateIpv4(host: string): boolean {
  if (METADATA_IPV4.has(host)) return true;
  const value = ipv4ToInt(host);
  if (value === null) return false;
  return PRIVATE_IPV4_RANGES.some(([start, end]) => value >= start && value <= end);
}

function isPrivateIpv6(host: string): boolean {
  const normalised = host.toLowerCase();
  if (normalised === "::1") return true;
  if (normalised.startsWith("fe80:")) return true; // link-local
  if (normalised.startsWith("fc") || normalised.startsWith("fd")) return true; // unique local
  if (normalised.startsWith("::ffff:")) {
    const mapped = normalised.slice("::ffff:".length);
    return isPrivateIpv4(mapped);
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (host.includes(":") && isPrivateIpv6(host)) return true;
  if (isPrivateIpv4(host)) return true;
  return false;
}

export type SsrfValidationResult =
  | { allowed: true; url: URL }
  | { allowed: false; reason: string };

export function validateCrawlUrl(
  rawUrl: string,
  allowedHostnames: string[],
  allowSubdomains = true,
): SsrfValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: "Invalid URL." };
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    return { allowed: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { allowed: false, reason: "Missing hostname." };
  }

  if (isBlockedHostname(hostname)) {
    return { allowed: false, reason: "Blocked hostname (private or local)." };
  }

  const port = parsed.port ? Number(parsed.port) : parsed.protocol === "https:" ? 443 : 80;
  if (BLOCKED_PORTS.has(port)) {
    return { allowed: false, reason: `Blocked port: ${port}` };
  }

  const allowed = allowedHostnames.map((h) => h.toLowerCase());
  const hostAllowed = allowed.some((allowedHost) => {
    if (hostname === allowedHost) return true;
    if (allowSubdomains && hostname.endsWith(`.${allowedHost}`)) return true;
    return false;
  });

  if (!hostAllowed) {
    return { allowed: false, reason: "Hostname not in allowed domains." };
  }

  return { allowed: true, url: parsed };
}

export function assertCrawlUrlAllowed(
  rawUrl: string,
  allowedHostnames: string[],
  allowSubdomains = true,
): URL {
  const result = validateCrawlUrl(rawUrl, allowedHostnames, allowSubdomains);
  if (!result.allowed) {
    throw new AppError("FORBIDDEN", result.reason);
  }
  return result.url;
}

/** @alias assertCrawlUrlAllowed */
export const assertCrawlUrl = assertCrawlUrlAllowed;
