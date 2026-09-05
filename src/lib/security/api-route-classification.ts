/**
 * Canonical API and page-route security classification.
 *
 * Middleware exemption only means "do not require a browser session at the middleware
 * layer". It never means "trust this request". Each session-exempt route must enforce
 * its own security boundary in the route handler (signature, token, worker secret, etc.).
 */

export const API_SECURITY_CLASSES = [
  "PUBLIC_WEB",
  "AUTHENTICATED",
  "PERMISSIONED",
  "TOKEN_PUBLIC",
  "WEBHOOK",
  "OAUTH_CALLBACK",
  "WORKER_INTERNAL",
  "CRON_INTERNAL",
  "TRACKING_PUBLIC",
] as const;

export type ApiSecurityClass = (typeof API_SECURITY_CLASSES)[number];

/** Classes that do not require a Supabase browser session at middleware. */
export const SESSION_EXEMPT_CLASSES: ReadonlySet<ApiSecurityClass> = new Set([
  "PUBLIC_WEB",
  "WEBHOOK",
  "OAUTH_CALLBACK",
  "WORKER_INTERNAL",
  "CRON_INTERNAL",
  "TOKEN_PUBLIC",
  "TRACKING_PUBLIC",
]);

const WEBHOOK_API_PREFIX = "/api/webhooks/";

const OAUTH_CALLBACK_API_PATHS = new Set([
  "/api/connectors/oauth/callback",
  "/api/social/oauth/callback",
]);

const OAUTH_CALLBACK_API_PREFIXES = [
  "/api/connectors/oauth/",
  "/api/integrations/oauth/",
  "/api/social/oauth/",
] as const;

const WORKER_API_PREFIXES = [
  "/api/publishing-scheduler/",
  "/api/publishing-jobs/",
  "/api/social-analytics-sync/",
  "/api/seo-crawl/",
  "/api/notifications/digest/",
] as const;

const WORKER_API_EXACT_PATHS = new Set([
  "/api/social-reports/process-due",
  "/api/digital-assets/process-due",
]);

const CRON_API_PREFIXES = ["/api/cron/", "/api/workers/"] as const;

const CRON_API_EXACT_PATHS = new Set(["/api/publishing-scheduler/process-due"]);

const TOKEN_PUBLIC_API_PREFIXES = ["/api/reports/shared/"] as const;

const TOKEN_PUBLIC_PAGE_PREFIXES = ["/reports/shared/"] as const;

const TRACKING_PUBLIC_API_EXACT_PATHS = new Set(["/api/tracking/v1/events"]);

const TOKEN_PUBLIC_API_EXACT_PATHS = new Set(["/api/tracking/v1/server-events"]);

const PUBLIC_API_PREFIXES = ["/api/health", "/api/readiness", "/api/auth/"] as const;

const PUBLIC_FORM_SUBMIT_PATTERN = /^\/api\/forms\/v1\/[^/]+\/submit$/;

export function isWebhookApiRoute(pathname: string): boolean {
  return pathname.startsWith(WEBHOOK_API_PREFIX);
}

export function isOAuthCallbackApiRoute(pathname: string): boolean {
  if (OAUTH_CALLBACK_API_PATHS.has(pathname)) {
    return true;
  }
  return OAUTH_CALLBACK_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isWorkerApiRoute(pathname: string): boolean {
  if (WORKER_API_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return WORKER_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isCronApiRoute(pathname: string): boolean {
  if (CRON_API_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return CRON_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isTokenPublicApiRoute(pathname: string): boolean {
  if (TOKEN_PUBLIC_API_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return TOKEN_PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isTokenPublicPageRoute(pathname: string): boolean {
  return TOKEN_PUBLIC_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isTrackingPublicApiRoute(pathname: string): boolean {
  if (TRACKING_PUBLIC_API_EXACT_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_FORM_SUBMIT_PATTERN.test(pathname);
}

export function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

/**
 * Returns the primary security class for an API pathname.
 * Non-API paths return null.
 */
export function classifyApiRoute(pathname: string): ApiSecurityClass | null {
  if (!pathname.startsWith("/api/")) {
    return null;
  }

  if (isWebhookApiRoute(pathname)) {
    return "WEBHOOK";
  }

  if (isOAuthCallbackApiRoute(pathname)) {
    return "OAUTH_CALLBACK";
  }

  if (isCronApiRoute(pathname)) {
    return "CRON_INTERNAL";
  }

  if (isWorkerApiRoute(pathname)) {
    return "WORKER_INTERNAL";
  }

  if (isTokenPublicApiRoute(pathname)) {
    return "TOKEN_PUBLIC";
  }

  if (isTrackingPublicApiRoute(pathname)) {
    return "TRACKING_PUBLIC";
  }

  if (isPublicApiRoute(pathname)) {
    return "PUBLIC_WEB";
  }

  return "AUTHENTICATED";
}

/**
 * Whether middleware should require a browser session for this pathname.
 * Session-exempt routes must enforce their own handler-level security boundary.
 */
export function isSessionExemptRoute(pathname: string): boolean {
  const apiClass = classifyApiRoute(pathname);
  if (apiClass) {
    return SESSION_EXEMPT_CLASSES.has(apiClass);
  }

  if (isTokenPublicPageRoute(pathname)) {
    return true;
  }

  if (pathname.startsWith("/auth/")) {
    return true;
  }

  return false;
}
