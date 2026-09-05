import { headers } from "next/headers";
import {
  E2E_AUTH_USER_HEADER,
  isE2eHarnessEnabled,
  isProductionEnvironment,
} from "@/lib/e2e/environment";

function isTestAuthEnvEnabled(): boolean {
  return process.env.ALLOW_TEST_AUTH === "true";
}

/**
 * Resolves the authenticated auth user id for harness mode.
 * User-controlled headers are ignored unless the harness is explicitly enabled.
 */
export async function resolveHarnessAuthUserId(): Promise<string | null> {
  if (isProductionEnvironment() || !isE2eHarnessEnabled() || !isTestAuthEnvEnabled()) {
    return null;
  }

  try {
    const headerList = await headers();
    const headerUserId = headerList.get(E2E_AUTH_USER_HEADER)?.trim();
    if (headerUserId) {
      return headerUserId;
    }
  } catch {
    // headers() is unavailable outside a request context.
  }

  return process.env.TEST_AUTH_USER_ID ?? null;
}

export function resolveHarnessAuthUserIdFromRequest(
  request: Pick<Request, "headers">,
): string | null {
  if (isProductionEnvironment() || !isE2eHarnessEnabled() || !isTestAuthEnvEnabled()) {
    return null;
  }

  const headerUserId = request.headers.get(E2E_AUTH_USER_HEADER)?.trim();
  if (headerUserId) {
    return headerUserId;
  }

  return process.env.TEST_AUTH_USER_ID ?? null;
}
