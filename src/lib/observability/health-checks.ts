import { prisma } from "@/lib/database/prisma";
import { getServerEnv } from "@/lib/environment";
import { isAiDiagnosticsEnabled } from "@/lib/ai/diagnostics-access";

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

export async function runReadinessChecks(): Promise<ReadinessReport> {
  const checks = await Promise.all([
    checkDatabaseConnectivity(),
    Promise.resolve(checkEnvironmentConfiguration()),
    Promise.resolve(checkJobSystem()),
    Promise.resolve(checkConnectorDiagnostics()),
  ]);

  const ready = checks.every((check) => check.status !== "fail");

  return {
    ready,
    checks,
    timestamp: new Date().toISOString(),
  };
}
