import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/database/prisma";
import { resolveAppUrl } from "@/lib/environment/app-url";
import {
  classifyKey,
  classifyProductionEnvironment,
  classifyUrl,
} from "@/lib/environment/classification";
import {
  getSupabaseConfigMetadata,
  getSupabaseServerConfig,
  readSupabaseServerConfigFromProcessEnv,
} from "@/lib/environment/supabase";
import { getServerEnv } from "@/lib/environment";

type MigrationSummary = {
  repositoryMigrationCount: number;
  appliedMigrationCount: number | null;
  pendingMigrationCount: number | null;
  latestAppliedMigration: string | null;
  failedMigrationCount: number | null;
};

async function checkDatabaseConnection(): Promise<{ success: boolean; errorCode?: string }> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { success: true };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : undefined;
    return { success: false, errorCode: code };
  }
}

async function getMigrationSummary(repositoryMigrationCount: number): Promise<MigrationSummary> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>
    >`SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY finished_at DESC`;

    const applied = rows.filter((row) => row.finished_at && !row.rolled_back_at);
    const failed = rows.filter((row) => !row.finished_at);

    return {
      repositoryMigrationCount,
      appliedMigrationCount: applied.length,
      pendingMigrationCount: Math.max(repositoryMigrationCount - applied.length, 0),
      latestAppliedMigration: applied[0]?.migration_name ?? null,
      failedMigrationCount: failed.length,
    };
  } catch {
    return {
      repositoryMigrationCount,
      appliedMigrationCount: null,
      pendingMigrationCount: null,
      latestAppliedMigration: null,
      failedMigrationCount: null,
    };
  }
}

async function checkSupabaseAuthHealth(): Promise<{
  success: boolean;
  errorName?: string;
  errorCode?: string;
}> {
  try {
    const { url, anonKey } = getSupabaseServerConfig();
    const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        success: false,
        errorName: "AuthHealthCheckFailed",
        errorCode: String(response.status),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      errorName: error instanceof Error ? error.name : "unknown",
      errorCode: error instanceof Error ? error.message : "unknown",
    };
  }
}

export async function buildAuthDatabaseDiagnostics(repositoryMigrationCount: number) {
  const serverConfig = readSupabaseServerConfigFromProcessEnv();
  const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serverEnv = getServerEnv();
  const environment = classifyProductionEnvironment();
  const databaseConnection = await checkDatabaseConnection();
  const migrationSummary = await getMigrationSummary(repositoryMigrationCount);
  const supabaseAuthHealth = await checkSupabaseAuthHealth();
  const callbackUrl = new URL("/auth/callback", resolveAppUrl());

  return {
    deploymentCommit:
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_REF ??
      process.env.GIT_COMMIT_SHA ??
      "unknown",
    environment,
    supabase: {
      publicUrl: classifyUrl(publicSupabaseUrl),
      serverUrl: classifyUrl(serverConfig.url),
      metadata: getSupabaseConfigMetadata(),
      publicAnonKey: classifyKey(publicAnonKey),
      serverAnonKey: classifyKey(serverConfig.anonKey),
      serviceRoleKey: classifyKey(serverEnv.SUPABASE_SERVICE_ROLE_KEY),
      authHealth: supabaseAuthHealth,
    },
    appUrl: classifyUrl(serverEnv.APP_URL),
    callbackUrlHost: callbackUrl.host,
    database: {
      runtimeUrl: classifyUrl(process.env.DATABASE_URL, { database: true }),
      directUrl: classifyUrl(process.env.DIRECT_URL, { database: true }),
      connection: databaseConnection,
      migrations: migrationSummary,
    },
    email: {
      resendApiKey: classifyKey(process.env.RESEND_API_KEY),
      resendProviderEnabled: process.env.RESEND_PROVIDER_ENABLED ?? "unset",
      emailEmergencyShutdown: process.env.EMAIL_EMERGENCY_SHUTDOWN ?? "unset",
      note: "Supabase Auth SMTP is configured in the Supabase dashboard and is separate from the Cresco Resend provider adapter.",
    },
    providerFlags: {
      providerConnectorsEnabled: process.env.PROVIDER_CONNECTORS_ENABLED ?? "unset",
      providerLiveCallsEnabled: process.env.PROVIDER_LIVE_CALLS_ENABLED ?? "unset",
    },
  };
}

export async function runControlledSignupProbe(email: string, password: string) {
  const { url, anonKey } = getSupabaseServerConfig();
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const redirectTo = new URL("/auth/callback", resolveAppUrl()).toString();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  return {
    redirectHost: new URL(redirectTo).host,
    supabaseHostSuffix: new URL(url).hostname.split(".").slice(-2).join("."),
    error: error
      ? {
          name: error.name,
          code: error.code,
          status: error.status,
          message: error.message,
        }
      : null,
    userPresent: Boolean(data.user),
    sessionPresent: Boolean(data.session),
    identitiesCount: data.user?.identities?.length ?? 0,
    antiEnumerationLikely:
      Boolean(data.user) && (data.user?.identities?.length ?? 0) === 0 && !data.session,
  };
}
