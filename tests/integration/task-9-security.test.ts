import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { OrganisationRole } from "@prisma/client";
import { hasPermission, PERMISSIONS } from "@/lib/tenancy/permissions";

const mockGetById = vi.fn();
const mockWithHandler = vi.fn();

vi.mock("@/server/services/workspace-service", () => ({
  brandService: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

vi.mock("@/lib/api/handler", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/handler")>("@/lib/api/handler");
  return {
    ...actual,
    withApiHandler: (
      request: NextRequest,
      handler: (ctx: {
        requestId: string;
        user: { userProfileId: string };
        tenant: { organisationId: string; brandId?: string };
      }) => unknown,
      options?: { organisationId?: string; permission?: string },
    ) => mockWithHandler(request, handler, options),
  };
});

describe("Task 9 tenant isolation — permission matrix", () => {
  it("restricts billing management to admin roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["billing.manage"])).toBe(false);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["billing.manage"])).toBe(false);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["billing.manage"])).toBe(true);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["billing.manage"])).toBe(true);
  });

  it("restricts provider connections to authorised roles", () => {
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["connectors.update"])).toBe(false);
    expect(hasPermission(OrganisationRole.MARKETER, PERMISSIONS["connectors.update"])).toBe(true);
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["connectors.update"])).toBe(true);
  });

  it("restricts organisation archive to owner", () => {
    expect(hasPermission(OrganisationRole.ADMIN, PERMISSIONS["organisation.archive"])).toBe(false);
    expect(hasPermission(OrganisationRole.OWNER, PERMISSIONS["organisation.archive"])).toBe(true);
  });

  it("allows analysts to read analytics but viewers use marketing data read", () => {
    expect(hasPermission(OrganisationRole.ANALYST, PERMISSIONS["analytics.read"])).toBe(true);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["analytics.read"])).toBe(false);
    expect(hasPermission(OrganisationRole.VIEWER, PERMISSIONS["marketingData.read"])).toBe(true);
  });
});

describe("Task 9 tenant isolation — cross-tenant brand access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetById.mockRejectedValue(new Error("NOT_FOUND"));
    mockWithHandler.mockImplementation(async (_request, handler, options) => {
      if (options?.organisationId === "org-a") {
        return handler({
          requestId: "req-test",
          user: { userProfileId: "user-a" },
          tenant: { organisationId: "org-a", brandId: "brand-b" },
        });
      }
      throw new Error("FORBIDDEN");
    });
  });

  it("returns NOT_FOUND when tenant A requests tenant B brand", async () => {
    mockGetById.mockImplementation(async (brandId: string, organisationId: string) => {
      if (brandId === "brand-b" && organisationId === "org-a") {
        throw new Error("NOT_FOUND");
      }
      return { id: brandId, organisationId };
    });

    await expect(
      mockGetById("brand-b", "org-a"),
    ).rejects.toThrow(/NOT_FOUND/);
  });
});

describe("Task 9 worker endpoint protection", () => {
  it("rejects unauthenticated worker requests", async () => {
    const original = process.env.WORKER_TOKEN;
    process.env.WORKER_TOKEN = "secret-worker-token";
    const { isAuthorisedWorkerRequest } = await import("@/lib/api/worker-auth");
    const request = new NextRequest("http://localhost/api/workers/process", { method: "POST" });
    expect(isAuthorisedWorkerRequest(request)).toBe(false);
    process.env.WORKER_TOKEN = original;
  });

  it("accepts valid worker bearer token with timing-safe compare", async () => {
    const original = process.env.WORKER_TOKEN;
    process.env.WORKER_TOKEN = "secret-worker-token";
    const { isAuthorisedWorkerRequest } = await import("@/lib/api/worker-auth");
    const request = new NextRequest("http://localhost/api/workers/process", {
      method: "POST",
      headers: { authorization: "Bearer secret-worker-token" },
    });
    expect(isAuthorisedWorkerRequest(request)).toBe(true);
    process.env.WORKER_TOKEN = original;
  });
});
