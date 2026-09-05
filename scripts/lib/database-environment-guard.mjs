/**
 * Pure-JS database environment guard for Node scripts (no TS transpile required).
 */

const PRODUCTION_HOST_MARKERS = ["supabase.co", "pooler.supabase.com"];

function classifyUrl(value) {
  if (!value) {
    return { present: false, isLocalhost: false, databaseName: null, hostSuffix: null };
  }

  try {
    const parsed = new URL(value);
    const isLocalhost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    const hostSuffix = isLocalhost
      ? "localhost"
      : parsed.hostname.split(".").slice(-2).join(".");
    const databaseName = parsed.pathname.replace(/^\//, "") || "(default)";
    return { present: true, isLocalhost, databaseName, hostSuffix };
  } catch {
    return { present: true, isLocalhost: false, databaseName: null, hostSuffix: null };
  }
}

function inferEnvironment(url, nodeEnv) {
  const classified = classifyUrl(url);
  if (!classified.present) return "unknown";
  if (classified.isLocalhost) return nodeEnv === "test" ? "test" : "development";
  if (/staging|preview|uat|nonprod|dev\./i.test(url ?? "")) return "staging";
  if (PRODUCTION_HOST_MARKERS.some((marker) => (url ?? "").includes(marker))) {
    return /staging|preview|uat|nonprod/i.test(url ?? "") ? "staging" : "production";
  }
  return "unknown";
}

export function classifyDatabaseTarget(databaseUrl = process.env.DATABASE_URL, nodeEnv = process.env.NODE_ENV) {
  const classified = classifyUrl(databaseUrl);
  const environment = inferEnvironment(databaseUrl, nodeEnv);
  const safeIdentifier = [
    environment,
    classified.hostSuffix ?? "unknown-host",
    classified.databaseName ?? "unknown-db",
  ].join(":");

  return {
    environment,
    safeIdentifier,
    databaseName: classified.databaseName,
    hostSuffix: classified.hostSuffix,
    isLocalhost: classified.isLocalhost,
    isProductionLike: environment === "production",
    isTestLike: environment === "test" || classified.isLocalhost,
  };
}

export function assertSafeDatabaseOperation(input) {
  const target = classifyDatabaseTarget(input.databaseUrl, input.nodeEnv);
  const explicitlyAllowed = (input.explicitAllowFlag ?? process.env.ALLOW_PRODUCTION_DATABASE) === "confirm";

  if (input.operation === "audit") return target;
  if (input.operation === "migrate_deploy" && input.allowProduction) return target;

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
