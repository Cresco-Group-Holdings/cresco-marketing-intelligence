const ALLOWED_REDIRECT_PROTOCOLS = ["https:", "http:"];

export function validateRedirectUrl(url: string, allowedDomains: string[]): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    if (!ALLOWED_REDIRECT_PROTOCOLS.includes(parsed.protocol)) {
      return { valid: false, error: "Redirect must use http or https." };
    }
    if (allowedDomains.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const allowed = allowedDomains.some((d) => host === d.toLowerCase() || host.endsWith(`.${d.toLowerCase()}`));
      if (!allowed) return { valid: false, error: "Redirect domain not in allowlist." };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid redirect URL." };
  }
}

export function validateOrigin(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return allowedOrigins.length === 0;
  if (allowedOrigins.length === 0) return true;
  const normalised = origin.replace(/\/$/, "").toLowerCase();
  return allowedOrigins.some((o) => normalised === o.replace(/\/$/, "").toLowerCase());
}

export function hashClientIp(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = (hash << 5) - hash + ip.charCodeAt(i);
    hash |= 0;
  }
  return `ip_${Math.abs(hash).toString(16)}`;
}
