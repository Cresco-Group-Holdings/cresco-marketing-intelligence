import { getServerEnv } from "@/lib/environment";
import type { ProviderOAuthConfigStatus } from "@/lib/providers/oauth/types";
import { PRODUCTION_OAUTH_PROVIDER_KEYS } from "@/lib/providers/oauth/production-providers";

export type ProviderOAuthConfigDetail = {
  status: ProviderOAuthConfigStatus;
  missingEnv: string[];
};

type ProviderEnvRequirements = {
  required: string[];
  check: (env: ReturnType<typeof getServerEnv>) => boolean;
};

const GOOGLE_ENV: ProviderEnvRequirements = {
  required: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  check: (env) => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
};

const PROVIDER_ENV_REQUIREMENTS: Record<string, ProviderEnvRequirements> = {
  "google-analytics": GOOGLE_ENV,
  "google-search-console": GOOGLE_ENV,
  youtube: GOOGLE_ENV,
  meta: {
    required: ["META_APP_ID", "META_APP_SECRET"],
    check: (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  },
  "meta-ads": {
    required: ["META_APP_ID", "META_APP_SECRET"],
    check: (env) => Boolean(env.META_APP_ID && env.META_APP_SECRET),
  },
  linkedin: {
    required: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    check: (env) => Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET),
  },
  x: {
    required: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    check: (env) => Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET),
  },
  tiktok: {
    required: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    check: (env) => Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET),
  },
};

export function getProviderOAuthConfigDetail(providerKey: string): ProviderOAuthConfigDetail {
  if (!(PRODUCTION_OAUTH_PROVIDER_KEYS as readonly string[]).includes(providerKey)) {
    return { status: "DISABLED", missingEnv: [] };
  }

  const requirements = PROVIDER_ENV_REQUIREMENTS[providerKey];
  if (!requirements) {
    return { status: "MISCONFIGURED", missingEnv: ["adapter"] };
  }

  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch {
    return { status: "MISCONFIGURED", missingEnv: requirements.required };
  }

  if (requirements.check(env)) {
    return { status: "READY", missingEnv: [] };
  }

  const missingEnv = requirements.required.filter((key) => {
    const value = env[key as keyof typeof env];
    return !value || String(value).trim().length === 0;
  });

  return { status: "MISCONFIGURED", missingEnv };
}

export function isProductionOAuthProviderReady(providerKey: string): boolean {
  return getProviderOAuthConfigDetail(providerKey).status === "READY";
}

export function listProductionOAuthProviderKeys(): readonly string[] {
  return PRODUCTION_OAUTH_PROVIDER_KEYS;
}
