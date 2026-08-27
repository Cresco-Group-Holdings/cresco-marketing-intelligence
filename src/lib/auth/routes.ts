export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/privacy",
  "/terms",
  "/accept-invite",
]);

export const AUTH_ROUTES = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
]);

export const ONBOARDING_ROUTE = "/onboarding";
export const GETTING_STARTED_ROUTE = "/getting-started";
export const DEMO_WORKSPACE_ROUTE = "/demo";

export const ACTIVATION_ROUTES = new Set([
  GETTING_STARTED_ROUTE,
  DEMO_WORKSPACE_ROUTE,
]);

export function isActivationRoute(pathname: string): boolean {
  if (ACTIVATION_ROUTES.has(pathname)) {
    return true;
  }

  return pathname.startsWith(`${DEMO_WORKSPACE_ROUTE}/`);
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

export function isOnboardingRoute(pathname: string): boolean {
  return pathname === ONBOARDING_ROUTE || pathname.startsWith(`${ONBOARDING_ROUTE}/`);
}

export function isProtectedRoute(pathname: string): boolean {
  if (isPublicRoute(pathname)) {
    return false;
  }

  if (pathname.startsWith("/api/health") || pathname.startsWith("/api/readiness")) {
    return false;
  }

  if (pathname.startsWith("/auth/")) {
    return false;
  }

  if (pathname.startsWith("/api/auth/")) {
    return false;
  }

  if (pathname.startsWith("/api/tracking/v1/events")) {
    return false;
  }

  if (pathname.startsWith("/api/connectors/oauth/")) {
    return false;
  }

  if (
    process.env.NODE_ENV === "development" &&
    (pathname === "/dev/command-centre-preview" ||
      pathname.startsWith("/dev/organic-growth-preview") ||
      pathname.startsWith("/dev/content-intelligence-preview"))
  ) {
    return false;
  }

  if (isWorkerApiRoute(pathname)) {
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
