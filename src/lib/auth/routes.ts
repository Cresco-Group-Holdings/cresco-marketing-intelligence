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

  return true;
}

export function isSettingsAccountRoute(pathname: string): boolean {
  return (
    pathname === "/settings/account" ||
    pathname === "/settings/security" ||
    pathname === "/settings/sessions"
  );
}
