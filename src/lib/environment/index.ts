import { z } from "zod";

const optionalNonEmptyString = z
  .string()
  .optional()
  .transform((value) => (value && value.trim().length > 0 ? value.trim() : undefined));

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY must be at least 32 characters"),
  OPENAI_API_KEY: optionalNonEmptyString,
  ANTHROPIC_API_KEY: optionalNonEmptyString,
  GOOGLE_AI_API_KEY: optionalNonEmptyString,
  GOOGLE_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_CLIENT_SECRET: optionalNonEmptyString,
  GOOGLE_ADS_DEVELOPER_TOKEN: optionalNonEmptyString,
  META_APP_ID: optionalNonEmptyString,
  META_APP_SECRET: optionalNonEmptyString,
  TIKTOK_CLIENT_KEY: optionalNonEmptyString,
  TIKTOK_CLIENT_SECRET: optionalNonEmptyString,
  LINKEDIN_CLIENT_ID: optionalNonEmptyString,
  LINKEDIN_CLIENT_SECRET: optionalNonEmptyString,
  X_CLIENT_ID: optionalNonEmptyString,
  X_CLIENT_SECRET: optionalNonEmptyString,
  PROVIDER_ENCRYPTION_KEY: optionalNonEmptyString,
  PROVIDER_ENCRYPTION_KEY_VERSION: optionalNonEmptyString,
  OAUTH_STATE_SIGNING_KEY: optionalNonEmptyString,
  OAUTH_CALLBACK_BASE_URL: optionalNonEmptyString,
  WEBHOOK_BASE_URL: optionalNonEmptyString,
  PROVIDER_CONNECTORS_ENABLED: optionalNonEmptyString,
  PROVIDER_LIVE_CALLS_ENABLED: optionalNonEmptyString,
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

export type IntegrationStatus = {
  configured: boolean;
  label: string;
};

export type IntegrationConfigStatus = {
  openai: IntegrationStatus;
  anthropic: IntegrationStatus;
  google: IntegrationStatus;
  meta: IntegrationStatus;
  tiktok: IntegrationStatus;
  linkedin: IntegrationStatus;
  x: IntegrationStatus;
};

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("\n");
}

function integrationStatus(label: string, ...values: Array<string | undefined>): IntegrationStatus {
  const configured = values.every((value) => Boolean(value && value.trim().length > 0));
  return { label, configured };
}

export function getIntegrationStatus(env: ServerEnv): IntegrationConfigStatus {
  return {
    openai: integrationStatus("OpenAI", env.OPENAI_API_KEY),
    anthropic: integrationStatus("Anthropic", env.ANTHROPIC_API_KEY),
    google: integrationStatus("Google", env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET),
    meta: integrationStatus("Meta", env.META_APP_ID, env.META_APP_SECRET),
    tiktok: integrationStatus("TikTok", env.TIKTOK_CLIENT_KEY, env.TIKTOK_CLIENT_SECRET),
    linkedin: integrationStatus("LinkedIn", env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET),
    x: integrationStatus("X", env.X_CLIENT_ID, env.X_CLIENT_SECRET),
  };
}

let cachedServerEnv: ServerEnv | null = null;
let cachedClientEnv: ClientEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid server environment configuration:\n${formatZodError(parsed.error)}`,
    );
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function getClientEnv(): ClientEnv {
  if (cachedClientEnv) {
    return cachedClientEnv;
  }

  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment configuration:\n${formatZodError(parsed.error)}`,
    );
  }

  cachedClientEnv = parsed.data;
  return cachedClientEnv;
}

export function resetEnvCacheForTests(): void {
  cachedServerEnv = null;
  cachedClientEnv = null;
}

export function validateEnvironmentOnStartup(): void {
  getServerEnv();
  getClientEnv();
}
