import { isProtectedRoute } from "@/lib/auth/routes";
import { E2E_AUTH_USER_HEADER, isE2eHarnessEnabled } from "@/lib/e2e/environment";
import { isProductionEnvironment } from "@/lib/security/production-guards";

/**
 * Middleware-only harness bypass. Requires an explicit per-request auth header or a
 * seeded server default user — never a blanket bypass for unauthenticated traffic.
 */
export function shouldBypassHarnessProtectedRoute(
  request: Pick<Request, "headers">,
  pathname: string,
): boolean {
  if (!isProtectedRoute(pathname)) {
    return false;
  }

  if (isProductionEnvironment()) {
    return false;
  }

  if (!isE2eHarnessEnabled() || process.env.ALLOW_TEST_AUTH !== "true") {
    return false;
  }

  const headerUserId = request.headers.get(E2E_AUTH_USER_HEADER)?.trim();
  if (headerUserId) {
    return true;
  }

  return Boolean(process.env.TEST_AUTH_USER_ID);
}
