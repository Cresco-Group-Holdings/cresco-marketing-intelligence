import { readFileSync } from "node:fs";
import path from "node:path";
import {
  E2E_MANIFEST_PATH,
  type E2eTenantManifest,
} from "./factories/tenant-factory";

export const E2E_AUTH_HEADER = "x-cresco-e2e-user-id";

export function isLaunchE2eEnabled(): boolean {
  return process.env.CRESCO_E2E_HARNESS === "true" && process.env.ALLOW_TEST_AUTH === "true";
}

export function requireLaunchE2e(test: { skip: (condition: boolean, reason?: string) => void }) {
  test.skip(!isLaunchE2eEnabled(), "Requires CRESCO_E2E_HARNESS=true and ALLOW_TEST_AUTH=true");
}

export function loadTenantManifest(): E2eTenantManifest {
  const manifestPath = process.env.E2E_TENANT_MANIFEST ?? E2E_MANIFEST_PATH;
  return JSON.parse(readFileSync(manifestPath, "utf8")) as E2eTenantManifest;
}

export function authHeaders(authUserId: string): Record<string, string> {
  return { [E2E_AUTH_HEADER]: authUserId };
}

export function redactSensitive(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/("(?:access|refresh)_token"\s*:\s*")[^"]+"/gi, '$1[REDACTED]"')
    .replace(/(password=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(postgresql:\/\/)[^@]+@/gi, "$1[REDACTED]@");
}

export const LAUNCH_SHELL_ROUTES = [
  "/dashboard",
  "/calendar",
  "/getting-started",
  "/content/studio",
  "/analytics",
  "/integrations",
  "/automations",
  "/operations",
  "/settings",
] as const;

export const PUBLIC_SMOKE_ROUTES = [
  { path: "/", heading: /Connect your marketing stack/i },
  { path: "/product", heading: /One product for the full marketing loop/i },
  { path: "/pricing", heading: /Pricing/i },
  { path: "/privacy", heading: /Privacy Policy/i },
  { path: "/terms", heading: /Terms of Service/i },
  { path: "/cookies", heading: /Cookie Policy/i },
] as const;
