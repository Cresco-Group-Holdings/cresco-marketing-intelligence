import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { TenantContext } from "@/lib/tenancy/context";

const mockImport = vi.fn();
const mockQuery = vi.fn();
const mockExecutive = vi.fn();

vi.mock("@/server/services/analytics-core-service", () => ({
  analyticsCoreService: {
    importManualMetrics: (...args: unknown[]) => mockImport(...args),
    queryFacts: (...args: unknown[]) => mockQuery(...args),
    aggregateMetrics: vi.fn().mockResolvedValue({ totals: {}, currencies: {} }),
  },
}));

vi.mock("@/server/services/analytics-dashboard-service", () => ({
  analyticsDashboardService: {
    getExecutiveOverview: (...args: unknown[]) => mockExecutive(...args),
  },
}));

vi.mock("@/lib/api/handler", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    withApiHandler: (
      _request: NextRequest,
      handler: (ctx: {
        requestId: string;
        tenant: TenantContext;
        user: { userProfileId: string };
      }) => unknown,
    ) =>
      handler({
        requestId: "req-test",
        tenant: {
          organisationId: "org-1",
          userId: "user-1",
          userProfileId: "user-profile-1",
          organisationRole: "OWNER",
        },
        user: { userProfileId: "user-profile-1" },
      }),
  };
});

describe("analytics imports route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImport.mockResolvedValue({ id: "batch-1", status: "COMPLETED" });
  });

  it("accepts manual import payloads", async () => {
    const { POST } = await import("@/app/api/analytics/imports/route");
    const request = new NextRequest("http://localhost/api/analytics/imports?organisationId=org-1", {
      method: "POST",
      body: JSON.stringify({
        rows: [
          {
            metricKey: "clicks",
            value: 10,
            occurredAt: "2026-08-01T00:00:00.000Z",
            granularity: "DAY",
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mockImport).toHaveBeenCalled();
  });
});

describe("analytics executive dashboard route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutive.mockResolvedValue({ contract: "executive_overview", baseMetrics: {} });
  });

  it("returns executive contract", async () => {
    const { GET } = await import("@/app/api/analytics/dashboard/executive/route");
    const params = new URLSearchParams({
      organisationId: "org-1",
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
    });
    const request = new NextRequest(
      `http://localhost/api/analytics/dashboard/executive?${params.toString()}`,
    );

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mockExecutive).toHaveBeenCalled();
  });
});
