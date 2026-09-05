import { classifyUrl } from "@/lib/environment/classification";

export type DatabaseEnvironment = "development" | "test" | "staging" | "production" | "unknown";

export type DatabaseTargetClassification = {
  environment: DatabaseEnvironment;
  safeIdentifier: string;
  databaseName: string | null;
  hostSuffix: string | null;
  isLocalhost: boolean;
  isProductionLike: boolean;
  isTestLike: boolean;
};

export type DestructiveDatabaseOperation =
  | "migrate_dev"
  | "migrate_deploy"
  | "db_push"
  | "db_seed"
  | "truncate"
  | "audit";

const PRODUCTION_HOST_MARKERS = ["supabase.co", "pooler.supabase.com"];

function inferEnvironment(
  url: string | undefined,
  nodeEnv: string | undefined,
): DatabaseEnvironment {
  const classified = classifyUrl(url, { database: true });
  if (!classified.present || classified.classification === "missing") {
    return "unknown";
  }

  if (classified.isLocalhost) {
    return nodeEnv === "test" ? "test" : "development";
  }

  const raw = url ?? "";
  if (/staging|preview|uat|nonprod|dev\./i.test(raw)) {
    return "staging";
  }

  if (
    classified.classification === "supabase-production" ||
    PRODUCTION_HOST_MARKERS.some((marker) => raw.includes(marker))
  ) {
    return /staging|preview|uat|nonprod/i.test(raw) ? "staging" : "production";
  }

  return "unknown";
}

export function classifyDatabaseTarget(
  databaseUrl = process.env.DATABASE_URL,
  nodeEnv = process.env.NODE_ENV,
): DatabaseTargetClassification {
  const classified = classifyUrl(databaseUrl, { database: true });
  const environment = inferEnvironment(databaseUrl, nodeEnv);
  const databaseName = classified.databaseName ?? null;
  const hostSuffix = classified.hostSuffix ?? null;
  const safeIdentifier = [
    environment,
    hostSuffix ?? "unknown-host",
    databaseName ?? "unknown-db",
  ].join(":");

  return {
    environment,
    safeIdentifier,
    databaseName,
    hostSuffix,
    isLocalhost: classified.isLocalhost,
    isProductionLike: environment === "production",
    isTestLike: environment === "test" || classified.isLocalhost,
  };
}

export function assertSafeDatabaseOperation(input: {
  operation: DestructiveDatabaseOperation;
  databaseUrl?: string;
  nodeEnv?: string;
  allowProduction?: boolean;
  explicitAllowFlag?: string;
}): DatabaseTargetClassification {
  const target = classifyDatabaseTarget(input.databaseUrl, input.nodeEnv);
  const allowFlag = input.explicitAllowFlag ?? process.env.ALLOW_PRODUCTION_DATABASE;
  const explicitlyAllowed = allowFlag === "confirm";

  if (input.operation === "audit") {
    return target;
  }

  if (input.operation === "migrate_deploy" && input.allowProduction) {
    return target;
  }

  if (input.nodeEnv === "test" && target.isProductionLike && input.operation !== "migrate_deploy") {
    throw new Error(
      `Blocked ${input.operation}: test environment must not target production database (${target.safeIdentifier}).`,
    );
  }

  if (target.isProductionLike && !explicitlyAllowed) {
    throw new Error(
      `Blocked ${input.operation} against production-like database target (${target.safeIdentifier}). ` +
        "Set ALLOW_PRODUCTION_DATABASE=confirm only for controlled production deploy workflows.",
    );
  }

  if (input.operation === "truncate" && target.isProductionLike) {
    throw new Error(`Blocked truncate against production-like database (${target.safeIdentifier}).`);
  }

  return target;
}
