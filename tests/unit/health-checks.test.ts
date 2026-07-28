import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}));

vi.mock("@/lib/database/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/environment", () => ({
  getServerEnv: vi.fn(() => ({
    DATABASE_URL: "postgresql://test",
    DIRECT_URL: "postgresql://test",
    SUPABASE_SERVICE_ROLE_KEY: "key",
    APP_URL: "http://localhost:3000",
    ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  })),
}));
vi.mock("@/lib/ai/diagnostics-access", () => ({
  isAiDiagnosticsEnabled: vi.fn(() => true),
}));

import { runReadinessChecks } from "@/lib/observability/health-checks";

describe("runReadinessChecks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("reports ready when core checks pass", async () => {
    const report = await runReadinessChecks();
    expect(report.ready).toBe(true);
    expect(report.checks.some((check) => check.name === "database" && check.status === "pass")).toBe(
      true,
    );
  });

  it("reports not ready when database connectivity fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("connection refused"));
    const report = await runReadinessChecks();
    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "database")?.status).toBe("fail");
  });
});
