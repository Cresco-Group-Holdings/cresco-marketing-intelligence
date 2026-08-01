import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";

const prismaMock = {
  providerConnection: { findFirst: vi.fn(), update: vi.fn() },
  providerFeatureFlag: { findUnique: vi.fn() },
  providerOutboundSend: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  emailSuppression: { findUnique: vi.fn() },
  emailUnsubscribe: { findFirst: vi.fn() },
};

vi.mock("@/lib/database/prisma", () => ({
  prisma: prismaMock,
}));

vi.mock("@/server/services/provider-audit-service", () => ({
  providerAuditService: { recordEvent: vi.fn() },
}));

vi.mock("@/server/services/provider-health-service", () => ({
  providerHealthService: { upsertHealth: vi.fn() },
}));

describe("unified email provider gates", () => {
  beforeEach(async () => {
    resetEnvCacheForTests();
    process.env.PROVIDER_CONNECTORS_ENABLED = "true";
    process.env.PROVIDER_LIVE_CALLS_ENABLED = "false";
    process.env.EMAIL_EMERGENCY_SHUTDOWN = "false";
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("simulates send when live calls are disabled", async () => {
    const { unifiedEmailProviderService } = await import("@/server/services/unified-email-provider-service");

    prismaMock.providerConnection.findFirst.mockResolvedValue({
      id: "conn-1",
      organisationId: "org-1",
      providerKey: "resend",
      status: "CONNECTED",
      healthStates: [],
    });

    prismaMock.providerFeatureFlag.findUnique.mockResolvedValue(null);
    prismaMock.emailSuppression.findUnique.mockResolvedValue(null);
    prismaMock.emailUnsubscribe.findFirst.mockResolvedValue(null);
    prismaMock.providerOutboundSend.findUnique.mockResolvedValue(null);
    prismaMock.providerOutboundSend.upsert.mockResolvedValue({
      id: "out-1",
      requestId: "req-1",
      sentAt: new Date(),
    });
    prismaMock.providerOutboundSend.update.mockResolvedValue({
      id: "out-1",
      requestId: "req-1",
      sentAt: new Date(),
    });

    const result = await unifiedEmailProviderService.sendEmail(
      {
        organisationId: "org-1",
        connectionId: "conn-1",
        messageType: "TEST",
        from: "Test <onboarding@resend.dev>",
        to: ["delivered@resend.dev"],
        subject: "Test",
        html: "<p>Hi</p>",
        idempotencyKey: "idem-test-1",
      },
      {
        tenantContext: {
          userId: "u1",
          userProfileId: "up1",
          organisationId: "org-1",
          organisationRole: "OWNER",
        },
        connectionId: "conn-1",
        messageType: "TEST",
        testMode: true,
        requestId: "req-1",
      },
    );

    expect(result.status).toBe("SIMULATED");
    expect(result.accepted).toBe(true);
  });
});
