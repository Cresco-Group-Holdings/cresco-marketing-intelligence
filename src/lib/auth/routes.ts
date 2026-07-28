export const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/privacy",
  "/terms",
]);

export const AUTH_ROUTES = new Set(["/login", "/signup", "/forgot-password"]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname);
}

export function isProtectedRoute(pathname: string): boolean {
  if (isPublicRoute(pathname)) {
    return false;
  }

  if (pathname.startsWith("/api/health")) {
    return false;
  }

  if (pathname.startsWith("/auth/")) {
    return false;
  }

  return true;
}
