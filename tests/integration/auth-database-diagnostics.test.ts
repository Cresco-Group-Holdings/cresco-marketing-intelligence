import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/diagnostics/auth-database/route";

vi.mock("@/lib/auth/diagnostics-access", () => ({
  assertAuthDatabaseDiagnosticsAccess: vi.fn(),
}));

vi.mock("@/server/services/auth-database-diagnostics-service", () => ({
  buildAuthDatabaseDiagnostics: vi.fn(),
}));

import { assertAuthDatabaseDiagnosticsAccess } from "@/lib/auth/diagnostics-access";
import { buildAuthDatabaseDiagnostics } from "@/server/services/auth-database-diagnostics-service";

describe("GET /api/admin/diagnostics/auth-database", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns safe diagnostics metadata", async () => {
    vi.mocked(buildAuthDatabaseDiagnostics).mockResolvedValue({
      deploymentCommit: "abc123",
      environment: { isProductionReady: false, blockers: ["DATABASE_URL is missing or points to localhost."] },
      supabase: {
        publicUrl: { classification: "supabase-production", present: true },
      },
    } as never);

    const request = new NextRequest(
      "https://cresco-marketing-intelligence.vercel.app/api/admin/diagnostics/auth-database",
      {
        headers: {
          authorization: "Bearer diagnostics-token",
        },
      },
    );

    const response = await GET(request);
    const body = await response.json();

    expect(assertAuthDatabaseDiagnosticsAccess).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.deploymentCommit).toBe("abc123");
  });
});
