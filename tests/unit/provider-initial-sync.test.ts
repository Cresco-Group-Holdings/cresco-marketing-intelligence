import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerInitialSyncService } from "@/server/services/provider-initial-sync-service";
import { providerSyncEngineService } from "@/server/services/provider-sync-engine-service";
import { prisma } from "@/lib/database/prisma";

vi.mock("@/server/services/provider-sync-engine-service", () => ({
  providerSyncEngineService: {
    startSync: vi.fn().mockResolvedValue({ id: "sync_run_1", status: "QUEUED" }),
  },
}));

vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: {
    recordEvent: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("provider initial sync service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues initial sync with INITIAL_IMPORT trigger", async () => {
    const context = {
      organisationId: "org_test",
      userId: "user_test",
      userProfileId: "profile_test",
      organisationRole: "OWNER" as const,
      authUserId: "auth_test",
    };

    vi.spyOn(prisma.providerConnection, "findFirst").mockResolvedValue({
      id: "conn_test",
      organisationId: "org_test",
      providerKey: "linkedin",
      metadata: {},
    } as never);

    vi.spyOn(prisma.providerConnection, "update").mockResolvedValue({} as never);

    const result = await providerInitialSyncService.triggerAfterAccountSelection(
      context,
      "conn_test",
      "linkedin",
    );

    expect(result.queued).toBe(true);
    expect(providerSyncEngineService.startSync).toHaveBeenCalledWith(
      "conn_test",
      "org_test",
      expect.objectContaining({
        triggerType: "INITIAL_IMPORT",
        capability: "SOCIAL_INSIGHTS_READ",
      }),
      context,
    );
  });

  it("uses analytics capability for GA4", async () => {
    const context = {
      organisationId: "org_test",
      userId: "user_test",
      userProfileId: "profile_test",
      organisationRole: "OWNER" as const,
      authUserId: "auth_test",
    };

    vi.spyOn(prisma.providerConnection, "findFirst").mockResolvedValue({
      id: "conn_ga4",
      organisationId: "org_test",
      providerKey: "google-analytics",
      metadata: {},
    } as never);

    vi.spyOn(prisma.providerConnection, "update").mockResolvedValue({} as never);

    const result = await providerInitialSyncService.triggerAfterAccountSelection(
      context,
      "conn_ga4",
      "google-analytics",
    );

    expect(result.queued).toBe(true);
    expect(providerSyncEngineService.startSync).toHaveBeenCalledWith(
      "conn_ga4",
      "org_test",
      expect.objectContaining({
        capability: "ANALYTICS_REPORTS_READ",
      }),
      context,
    );
  });
});
