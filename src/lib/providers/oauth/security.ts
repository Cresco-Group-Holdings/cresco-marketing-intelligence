import { randomBytes } from "node:crypto";
import { PROVIDER_ALLOWED_RETURN_URL_PREFIXES } from "@/lib/providers/constants";

export function generateOAuthNonce(): string {
  return randomBytes(16).toString("base64url");
}

export function isReturnUrlAllowed(returnUrl: string | undefined | null): boolean {
  if (!returnUrl) {
    return true;
  }

  if (returnUrl.startsWith("http://") || returnUrl.startsWith("https://")) {
    return false;
  }

  if (!returnUrl.startsWith("/")) {
    return false;
  }

  return PROVIDER_ALLOWED_RETURN_URL_PREFIXES.some((prefix) => returnUrl.startsWith(prefix));
}

export function mapOAuthError(error: string, description?: string): { code: string; message: string } {
  const normalized = error.toLowerCase();
  if (normalized === "access_denied") {
    return { code: "OAUTH_ACCESS_DENIED", message: description ?? "Authorization was denied." };
  }
  if (normalized === "invalid_grant") {
    return { code: "OAUTH_INVALID_GRANT", message: description ?? "Authorization grant is invalid or expired." };
  }
  return { code: "OAUTH_ERROR", message: description ?? error };
}
