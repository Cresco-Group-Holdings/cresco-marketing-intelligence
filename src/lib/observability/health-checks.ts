import { prisma } from "@/lib/database/prisma";
import { getServerEnv } from "@/lib/environment";
import { isAiDiagnosticsEnabled } from "@/lib/ai/diagnostics-access";
import { getSeoMetricsSnapshot } from "@/lib/seo/observability";
import { isSeoEngineShutdown } from "@/lib/seo/quotas";
import { getAdvertisingMetricsSnapshot, isAdvertisingEmergencyShutdown } from "@/lib/advertising/observability";

export type HealthCheckStatus = "pass" | "fail" | "warn";

export type HealthCheckResult = {
  name: string;
  status: HealthCheckStatus;
  message: string;
};

export type ReadinessReport = {
  ready: boolean;
  checks: HealthCheckResult[];
  timestamp: string;
};

async function checkDatabaseConnectivity(): Promise<HealthCheckResult> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "database",
      status: "pass",
      message: "Database connection is healthy.",
    };
  } catch {
    return {
      name: "database",
      status: "fail",
      message: "Database connection failed.",
    };
  }
}

function checkEnvironmentConfiguration(): HealthCheckResult {
  try {
    getServerEnv();
    return {
      name: "environment",
      status: "pass",
      message: "Required server environment variables are configured.",
    };
  } catch {
    return {
      name: "environment",
      status: "fail",
      message: "Required server environment variables are missing or invalid.",
    };
  }
}

function checkJobSystem(): HealthCheckResult {
  return {
    name: "job_system",
    status: "pass",
    message:
      "Job provider abstraction is available. Production should use a persistent job backend.",
  };
}

function checkConnectorDiagnostics(): HealthCheckResult {
  const enabled = isAiDiagnosticsEnabled();
  if (process.env.NODE_ENV === "production" && enabled) {
    return {
      name: "connector_diagnostics",
      status: "warn",
      message: "AI diagnostics are enabled in production. Restrict to administrators only.",
    };
  }

  return {
    name: "connector_diagnostics",
    status: "pass",
    message: "Diagnostics access policy is acceptable for this environment.",
  };
}

function checkSeoEngineStatus(): HealthCheckResult {
  if (isSeoEngineShutdown()) {
    return {
      name: "seo_engine",
      status: "warn",
      message: "SEO_ENGINE_EMERGENCY_SHUTDOWN is enabled. Crawls are disabled.",
    };
  }
  const metrics = getSeoMetricsSnapshot();
  const failures = metrics.counters.crawl_failures ?? 0;
  const ssrf = metrics.counters.ssrf_attempts ?? 0;
  if (failures > 100) {
    return {
      name: "seo_engine",
      status: "warn",
      message: `Elevated crawl failure count: ${failures}.`,
    };
  }
  if (ssrf > 0) {
    return {
      name: "seo_engine",
      status: "warn",
      message: `SSRF attempts blocked since startup: ${ssrf}.`,
    };
  }
  return {
    name: "seo_engine",
    status: "pass",
    message: "SEO engine operational.",
  };
}

function checkAdvertisingPlatformStatus(): HealthCheckResult {
  if (isAdvertisingEmergencyShutdown()) {
    return {
      name: "advertising_platform",
      status: "warn",
      message: "ADVERTISING_EMERGENCY_SHUTDOWN is enabled. Provider mutations are blocked.",
    };
  }
  const metrics = getAdvertisingMetricsSnapshot();
  const launchFailures = metrics.counters.launch_failure ?? 0;
  const unauthorised = metrics.counters.unauthorised_mutation_attempts ?? 0;
  if (launchFailures > 50) {
    return {
      name: "advertising_platform",
      status: "warn",
      message: `Elevated launch failure count: ${launchFailures}.`,
    };
  }
  if (unauthorised > 0) {
    return {
      name: "advertising_platform",
      status: "warn",
      message: `Unauthorised mutation attempts blocked: ${unauthorised}.`,
    };
  }
  return {
    name: "advertising_platform",
    status: "pass",
    message: "Advertising platform operational.",
  };
}

export async function runReadinessChecks(): Promise<ReadinessReport> {
  const checks = await Promise.all([
    checkDatabaseConnectivity(),
    Promise.resolve(checkEnvironmentConfiguration()),
    Promise.resolve(checkJobSystem()),
    Promise.resolve(checkConnectorDiagnostics()),
    Promise.resolve(checkSeoEngineStatus()),
    Promise.resolve(checkAdvertisingPlatformStatus()),
  ]);

  const ready = checks.every((check) => check.status !== "fail");

  return {
    ready,
    checks,
    timestamp: new Date().toISOString(),
  };
}
