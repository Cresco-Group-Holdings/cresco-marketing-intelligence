import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/health-checks", () => ({
  runReadinessChecks: vi.fn(async () => ({
    ready: true,
    timestamp: "2025-01-01T00:00:00.000Z",
    checks: [{ name: "database", status: "pass", message: "ok" }],
  })),
}));

import { GET } from "@/app/api/readiness/route";

describe("GET /api/readiness", () => {
  it("returns readiness status without exposing secrets", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("ready");
    expect(JSON.stringify(body)).not.toMatch(/ENCRYPTION_KEY|service-role|password/i);
  });
});
