import { z } from "zod";

export type UrlClassification = {
  present: boolean;
  parseOk: boolean;
  protocol?: string;
  hostSuffix?: string;
  port?: string;
  databaseName?: string;
  isLocalhost: boolean;
  hasPlaceholder: boolean;
  classification: "missing" | "invalid" | "localhost" | "supabase-production" | "other";
};

export type KeyClassification = {
  present: boolean;
  length: number;
  fingerprint: string;
  looksPlaceholder: boolean;
};

function fingerprint(value: string): string {
  if (value.length <= 4) {
    return "***";
  }

  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function hasPlaceholder(value: string): boolean {
  return (
    /\[YOUR|PLACEHOLDER|CHANGEME|your-project\.supabase\.co|example\.supabase\.co|test-anon|public-anon-key/i.test(
      value,
    ) || value === "your-anon-key"
  );
}

export function classifyUrl(value: string | undefined, options?: { database?: boolean }): UrlClassification {
  if (!value) {
    return {
      present: false,
      parseOk: false,
      isLocalhost: false,
      hasPlaceholder: false,
      classification: "missing",
    };
  }

  try {
    const parsed = new URL(value);
    const isLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    const hostSuffix = isLocalhost
      ? "localhost"
      : parsed.hostname.split(".").slice(-2).join(".");
    const databaseName = options?.database
      ? parsed.pathname.replace(/^\//, "") || "(default)"
      : undefined;
    const placeholder = hasPlaceholder(value);
    const isSupabaseProduction =
      parsed.hostname.endsWith("supabase.co") ||
      parsed.hostname.endsWith("pooler.supabase.com");

    return {
      present: true,
      parseOk: true,
      protocol: parsed.protocol,
      hostSuffix,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : parsed.protocol === "postgresql:" ? "5432" : "80"),
      databaseName,
      isLocalhost,
      hasPlaceholder: placeholder,
      classification: placeholder
        ? "invalid"
        : isLocalhost
          ? "localhost"
          : isSupabaseProduction
            ? "supabase-production"
            : "other",
    };
  } catch {
    return {
      present: true,
      parseOk: false,
      isLocalhost: false,
      hasPlaceholder: hasPlaceholder(value),
      classification: "invalid",
    };
  }
}

export function classifyKey(value: string | undefined): KeyClassification {
  if (!value) {
    return {
      present: false,
      length: 0,
      fingerprint: "***",
      looksPlaceholder: true,
    };
  }

  return {
    present: true,
    length: value.length,
    fingerprint: fingerprint(value),
    looksPlaceholder: hasPlaceholder(value) || value.length < 20,
  };
}

export function classifyProductionEnvironment(): {
  isProductionReady: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];

  const supabasePublicUrl = classifyUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseServerUrl = classifyUrl(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL);
  const databaseUrl = classifyUrl(process.env.DATABASE_URL, { database: true });
  const directUrl = classifyUrl(process.env.DIRECT_URL, { database: true });
  const appUrl = classifyUrl(process.env.APP_URL);

  if (supabasePublicUrl.classification !== "supabase-production") {
    blockers.push("NEXT_PUBLIC_SUPABASE_URL is not a production Supabase host.");
  }

  if (supabaseServerUrl.classification !== "supabase-production") {
    blockers.push("Server Supabase URL is not a production Supabase host.");
  }

  if (databaseUrl.isLocalhost || databaseUrl.classification === "missing") {
    blockers.push("DATABASE_URL is missing or points to localhost.");
  }

  if (directUrl.isLocalhost || directUrl.classification === "missing") {
    blockers.push("DIRECT_URL is missing or points to localhost.");
  }

  if (appUrl.isLocalhost) {
    blockers.push("APP_URL points to localhost.");
  }

  const anonKey = classifyKey(
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  const serviceRoleKey = classifyKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (anonKey.looksPlaceholder) {
    blockers.push("Supabase anon key is missing or looks like a placeholder.");
  }

  if (serviceRoleKey.looksPlaceholder) {
    blockers.push("Supabase service-role key is missing or looks like a placeholder.");
  }

  if (
    serviceRoleKey.present &&
    anonKey.present &&
    process.env.SUPABASE_SERVICE_ROLE_KEY ===
      (process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    blockers.push("Service-role key must not equal the anon key.");
  }

  return {
    isProductionReady: blockers.length === 0,
    blockers,
  };
}

export const diagnosticsClassificationSchema = z.object({
  deploymentCommit: z.string().optional(),
  environment: z.object({
    isProductionReady: z.boolean(),
    blockers: z.array(z.string()),
  }),
});
