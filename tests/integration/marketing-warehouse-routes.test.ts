import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";

const registryService = vi.hoisted(() => ({
  listSources: vi.fn(),
  listAccounts: vi.fn(),
}));
const healthService = vi.hoisted(() => ({
  listHealth: vi.fn(),
}));
const queryService = vi.hoisted(() => ({
  queryMetrics: vi.fn(),
}));
const buildTenantContext = vi.hoisted(() => vi.fn());

vi.mock("@/server/services/marketing-warehouse-registry-service", () => ({
  marketingWarehouseRegistryService: registryService,
}));
vi.mock("@/server/services/marketing-warehouse-health-service", () => ({
  marketingWarehouseHealthService: healthService,
}));
vi.mock("@/server/services/marketing-warehouse-query-service", () => ({
  marketingWarehouseQueryService: queryService,
}));
vi.mock("@/lib/tenancy/guards", () => ({
  buildTenantContext,
}));
vi.mock("@/lib/auth/provisioning", () => ({
  ensureUserProfile: vi.fn(async () => ({
    authUserId: "warehouse-route-user",
    email: "warehouse-route@example.test",
    userProfileId: "profile-warehouse",
  })),
  extractProviderMetadata: vi.fn(() => ({})),
}));

import { GET as getSources } from "@/app/api/data-warehouse/sources/route";
import { GET as getHealth } from "@/app/api/data-warehouse/health/route";
import { GET as getMetrics } from "@/app/api/data-warehouse/metrics/route";

const originalAuth = process.env.ALLOW_TEST_AUTH;
const originalUser = process.env.TEST_AUTH_USER_ID;

function request(path: string) {
  return new NextRequest(`https://app.test${path}`);
}

describe("marketing warehouse API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_TEST_AUTH = "true";
    process.env.TEST_AUTH_USER_ID = "warehouse-route-user";
    process.env.TEST_AUTH_EMAIL = "warehouse-route@example.test";
    buildTenantContext.mockResolvedValue({
      userId: "warehouse-route-user",
      userProfileId: "profile-warehouse",
      organisationId: "org-warehouse",
      organisationRole: OrganisationRole.OWNER,
    });
    registryService.listSources.mockResolvedValue([{ key: "manual-import", isConnected: false }]);
    registryService.listAccounts.mockResolvedValue([]);
    healthService.listHealth.mockResolvedValue([]);
    queryService.queryMetrics.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(() => {
    process.env.ALLOW_TEST_AUTH = originalAuth;
    process.env.TEST_AUTH_USER_ID = originalUser;
  });

  it("rejects warehouse routes without organisation context", async () => {
    const response = await getSources(
      request("/api/data-warehouse/sources?brandId=brand-1"),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("TENANT_CONTEXT_REQUIRED");
  });

  it("returns source registry data for authorised users", async () => {
    const response = await getSources(
      request(
        "/api/data-warehouse/sources?brandId=brand-1&organisationId=org-warehouse",
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.sources[0].key).toBe("manual-import");
    expect(registryService.listAccounts).toHaveBeenCalledWith(
      "brand-1",
      "org-warehouse",
      expect.objectContaining({ organisationId: "org-warehouse" }),
    );
  });

  it("returns health summaries for authorised users", async () => {
    const response = await getHealth(
      request("/api/data-warehouse/health?brandId=brand-1&organisationId=org-warehouse"),
    );
    expect(response.status).toBe(200);
    expect(healthService.listHealth).toHaveBeenCalled();
  });

  it("rejects metric queries with an oversized date range", async () => {
    queryService.queryMetrics.mockRejectedValue({
      code: "VALIDATION_ERROR",
      message: "Date range exceeds maximum of 366 days.",
    });

    const response = await getMetrics(
      request(
        "/api/data-warehouse/metrics?brandId=brand-1&organisationId=org-warehouse&from=2020-01-01T00:00:00.000Z&to=2026-07-30T23:59:59.999Z",
      ),
    );

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
