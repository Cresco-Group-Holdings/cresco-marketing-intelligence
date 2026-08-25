export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/privacy",
  "/terms",
]);

export const AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
]);

export const ONBOARDING_ROUTE = "/onboarding";

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

export function isOnboardingRoute(pathname: string): boolean {
  return pathname === ONBOARDING_ROUTE || pathname.startsWith(`${ONBOARDING_ROUTE}/`);
}

/** API routes that must remain reachable without a browser session. */
export function isPublicApiRoute(pathname: string): boolean {
  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/readiness")) {
    return true;
  }

  if (pathname.startsWith("/api/auth/")) {
    return true;
  }

  // External provider webhooks (Stripe, billing, social, email, etc.)
  if (pathname.startsWith("/api/webhooks/")) {
    return true;
  }

  // Public lead capture forms (embeddable)
  if (pathname.startsWith("/api/forms/v1/")) {
    return true;
  }

  // Client-side tracking beacon
  if (pathname.startsWith("/api/tracking/v1/events")) {
    return true;
  }

  // Server-side tracking (API key authenticated in route handler)
  if (pathname.startsWith("/api/tracking/v1/server-events")) {
    return true;
  }

  // OAuth callbacks — session may expire during provider round-trip
  if (pathname.startsWith("/api/connectors/oauth/")) {
    return true;
  }

  if (pathname.startsWith("/api/integrations/oauth/")) {
    return true;
  }

  if (pathname.startsWith("/api/social/oauth/")) {
    return true;
  }

  if (isWorkerApiRoute(pathname)) {
    return true;
  }

  return false;
}

export function isDevPreviewRoute(pathname: string): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    (pathname === "/dev/command-centre-preview" ||
      pathname.startsWith("/dev/organic-growth-preview") ||
      pathname.startsWith("/dev/analytics-preview") ||
      pathname.startsWith("/dev/security-preview"))
  );
}

export function isProtectedRoute(pathname: string): boolean {
  if (isPublicRoute(pathname)) {
    return false;
  }

  if (pathname.startsWith("/auth/")) {
    return false;
  }

  if (isPublicApiRoute(pathname)) {
    return false;
  }

  if (isDevPreviewRoute(pathname)) {
    return false;
  }

  return true;
}

const WORKER_API_PREFIXES = [
  "/api/workers/",
  "/api/cron/",
  "/api/publishing-scheduler/",
  "/api/publishing-jobs/",
  "/api/social-analytics-sync/",
  "/api/seo-crawl/",
  "/api/notifications/digest/",
  "/api/digital-assets/process-due",
  "/api/social-reports/process-due",
] as const;

export function isWorkerApiRoute(pathname: string): boolean {
  return WORKER_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isSettingsAccountRoute(pathname: string): boolean {
  return (
    pathname === "/settings/account" ||
    pathname === "/settings/security" ||
    pathname === "/settings/sessions"
  );
}
