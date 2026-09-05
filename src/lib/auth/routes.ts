import {
  classifyApiRoute,
  isOAuthCallbackApiRoute,
  isPublicApiRoute as isClassifiedPublicApiRoute,
  isSessionExemptRoute,
  isTokenPublicPageRoute,
  isTrackingPublicApiRoute,
  isWebhookApiRoute,
  isWorkerApiRoute as isClassifiedWorkerApiRoute,
} from "@/lib/security/api-route-classification";

export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/reset-password",
  "/privacy",
  "/terms",
  "/pricing",
  "/product",
  "/cookies",
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

/** API routes that must remain reachable without a browser session. */
export function isPublicApiRoute(pathname: string): boolean {
  return isClassifiedPublicApiRoute(pathname) || isSessionExemptRoute(pathname);
}

export function isDevPreviewRoute(pathname: string): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return (
    pathname === "/dev/command-centre-preview" ||
    pathname === "/dev/billing-preview" ||
    pathname.startsWith("/dev/organic-growth-preview") ||
    pathname.startsWith("/dev/onboarding-preview") ||
    pathname.startsWith("/dev/analytics-preview") ||
    pathname.startsWith("/dev/security-preview")
  );
}

/**
 * Returns true when middleware must enforce a Supabase browser session.
 * Exempt routes still require handler-level authentication (webhook signatures,
 * share tokens, worker secrets, OAuth state, etc.).
 */
export function isProtectedRoute(pathname: string): boolean {
  if (isPublicRoute(pathname)) {
    return false;
  }

  if (pathname.startsWith("/auth/")) {
    return false;
  }

  if (isTokenPublicPageRoute(pathname)) {
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

  if (isPublicApiRoute(pathname)) {
    return false;
  }

  if (isDevPreviewRoute(pathname)) {
    return false;
  }

  return true;
}

const LEGACY_WORKER_API_PREFIXES = [
  "/api/workers/",
  "/api/cron/",
  "/api/digital-assets/process-due",
] as const;

export function isWorkerApiRoute(pathname: string): boolean {
  if (isClassifiedWorkerApiRoute(pathname)) {
    return true;
  }

  return LEGACY_WORKER_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isSettingsAccountRoute(pathname: string): boolean {
  return (
    pathname === "/settings/account" ||
    pathname === "/settings/security" ||
    pathname === "/settings/sessions"
  );
}

export {
  classifyApiRoute,
  isOAuthCallbackApiRoute,
  isTokenPublicPageRoute,
  isTrackingPublicApiRoute,
  isWebhookApiRoute,
};
