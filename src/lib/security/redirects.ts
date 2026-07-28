import { getServerEnv } from "@/lib/environment";

const DEFAULT_ALLOWED_PATHS = ["/", "/login", "/signup", "/forgot-password"];

export function isSafeRedirectPath(path: string | null | undefined): boolean {
  if (!path) {
    return false;
  }

  if (!path.startsWith("/")) {
    return false;
  }

  if (path.startsWith("//")) {
    return false;
  }

  if (path.includes("://")) {
    return false;
  }

  if (path.includes("\\")) {
    return false;
  }

  return true;
}

export function resolveSafeRedirectPath(
  requestedPath: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (isSafeRedirectPath(requestedPath)) {
    return requestedPath!;
  }

  return fallback;
}

export function getAllowedAuthRedirectPaths(): string[] {
  const { APP_URL } = getServerEnv();
  const origin = new URL(APP_URL).origin;

  return DEFAULT_ALLOWED_PATHS.map((path) => `${origin}${path}`);
}
