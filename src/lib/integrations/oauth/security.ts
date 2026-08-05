import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/environment";
import { encryptSecret, decryptSecret } from "@/lib/security/encryption";
import {
  INTEGRATIONS_CALLBACK_PATH,
  INTEGRATIONS_RETURN_PATH_PREFIXES,
} from "@/lib/integrations/oauth/constants";

export function resolveOAuthCallbackUrl(providerKey: string): string {
  const env = getServerEnv();
  const base = env.OAUTH_CALLBACK_BASE_URL ?? `${env.APP_URL}${INTEGRATIONS_CALLBACK_PATH}`;
  return `${base.replace(/\/$/, "")}/${providerKey}/callback`;
}

export function validateRedirectUri(redirectUri: string, expectedRedirectUri: string): void {
  if (!isRedirectUriAllowed(redirectUri, expectedRedirectUri)) {
    throw new Error("Redirect URI is not allowed.");
  }
}

export function isRedirectUriAllowed(redirectUri: string, expectedRedirectUri: string): boolean {
  try {
    const received = new URL(redirectUri);
    const allowed = new URL(expectedRedirectUri);
    return received.origin === allowed.origin && received.pathname === allowed.pathname;
  } catch {
    return false;
  }
}

export function buildStateDigest(stateToken: string): string {
  return createHash("sha256").update(stateToken).digest("hex");
}

export function encryptOAuthPayload(payload: Record<string, unknown>): string {
  return encryptSecret(JSON.stringify(payload));
}

export function decryptOAuthPayload(encrypted: string): {
  stateToken: string;
  signedState: string;
  organisationId: string;
  userId: string;
  providerKey: string;
  connectionId: string;
} {
  return JSON.parse(decryptSecret(encrypted)) as {
    stateToken: string;
    signedState: string;
    organisationId: string;
    userId: string;
    providerKey: string;
    connectionId: string;
  };
}

export function encryptPkceVerifierReference(codeVerifier: string): string {
  return encryptSecret(codeVerifier);
}

export function decryptPkceVerifierReference(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null;
  return decryptSecret(encrypted);
}

export function validateReturnPath(returnPath?: string): string {
  if (!returnPath) {
    return "/integrations";
  }
  if (returnPath.startsWith("http://") || returnPath.startsWith("https://")) {
    throw new Error("Return path must be relative.");
  }
  if (!returnPath.startsWith("/")) {
    throw new Error("Return path must start with /.");
  }
  const allowed = INTEGRATIONS_RETURN_PATH_PREFIXES.some((prefix) => returnPath.startsWith(prefix));
  if (!allowed) {
    throw new Error("Return path is not allowed.");
  }
  return returnPath;
}
