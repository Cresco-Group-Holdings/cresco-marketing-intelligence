import { getServerEnv } from "@/lib/environment";

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

function addOrigin(origins: Set<string>, value: string | undefined): void {
  if (!value) {
    return;
  }

  try {
    origins.add(normalizeOrigin(value.startsWith("http") ? value : `https://${value}`));
  } catch {
    // Ignore invalid deployment host values.
  }
}

export function resolveAppUrl(): string {
  const { APP_URL } = getServerEnv();
  const appUrl = new URL(APP_URL);

  if (!appUrl.hostname.includes("localhost") && !appUrl.hostname.includes("127.0.0.1")) {
    return APP_URL;
  }

  const deploymentHost = process.env.VERCEL_URL ?? process.env.VERCEL_BRANCH_URL;
  if (deploymentHost) {
    return `https://${deploymentHost}`;
  }

  return APP_URL;
}

export function resolveAllowedOrigins(): string[] {
  const origins = new Set<string>();

  addOrigin(origins, getServerEnv().APP_URL);
  addOrigin(origins, resolveAppUrl());
  addOrigin(origins, process.env.VERCEL_URL);
  addOrigin(origins, process.env.VERCEL_BRANCH_URL);

  return [...origins];
}
