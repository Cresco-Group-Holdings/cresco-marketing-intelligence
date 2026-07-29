import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  socialConnection: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
const credentials = vi.hoisted(() => ({ upsertTokens: vi.fn() }));
const meta = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));
const linkedin = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));
const tiktok = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));
const youtube = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));
const x = vi.hoisted(() => ({ refreshAccessToken: vi.fn() }));

vi.mock("@/lib/database/prisma", () => ({ prisma }));
vi.mock("@/server/services/social-credential-service", () => ({
  socialCredentialService: credentials,
}));
vi.mock("@/lib/social/meta-credential-adapter", () => ({ metaCredentialAdapter: meta }));
vi.mock("@/lib/social/linkedin-credential-adapter", () => ({
  linkedInCredentialAdapter: linkedin,
}));
vi.mock("@/lib/social/tiktok-credential-adapter", () => ({ tikTokCredentialAdapter: tiktok }));
vi.mock("@/lib/social/youtube-x-credential-adapters", () => ({
  youtubeCredentialAdapter: youtube,
  xCredentialAdapter: x,
}));

import { socialAnalyticsCredentialService } from "@/server/services/social-analytics-credential-service";

const scope = {
  socialConnectionId: "connection-1",
  organisationId: "org-1",
  brandId: "brand-1",
};

describe("socialAnalyticsCredentialService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.socialConnection.findFirst.mockResolvedValue({ id: "connection-1" });
    prisma.socialConnection.update.mockResolvedValue({});
    prisma.socialConnection.updateMany.mockResolvedValue({ count: 1 });
    credentials.upsertTokens.mockResolvedValue({});
    for (const adapter of [meta, linkedin, tiktok, youtube, x]) {
      adapter.refreshAccessToken.mockResolvedValue({
        accessToken: "fresh-token",
        refreshToken: "fresh-refresh",
        expiresAt: new Date("2026-09-01T00:00:00Z"),
      });
    }
  });

  it.each([
    ["INSTAGRAM", meta],
    ["FACEBOOK", meta],
    ["LINKEDIN", linkedin],
    ["TIKTOK", tiktok],
    ["YOUTUBE", youtube],
    ["X", x],
  ] as const)("refreshes %s through its production credential adapter", async (provider, adapter) => {
    const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
      ...scope,
      provider,
      tokens: { accessToken: "stale", refreshToken: "stored-refresh" },
    });
    expect(adapter.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: "REFRESHED" });
    expect(credentials.upsertTokens).toHaveBeenCalledWith(
      "connection-1",
      expect.objectContaining({ accessToken: "fresh-token" }),
    );
    expect(prisma.socialConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONNECTED", reconnectRequiredAt: null }),
      }),
    );
  });

  it("keeps the stored refresh token when the provider does not return a new one", async () => {
    meta.refreshAccessToken.mockResolvedValue({ accessToken: "fresh-token" });
    const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
      ...scope,
      provider: "INSTAGRAM",
      tokens: { accessToken: "stale", refreshToken: "stored-refresh" },
    });
    expect(outcome).toEqual({
      status: "REFRESHED",
      tokens: { accessToken: "fresh-token", refreshToken: "stored-refresh" },
    });
  });

  it.each(["LINKEDIN", "TIKTOK", "YOUTUBE", "X"] as const)(
    "fails %s explicitly when no refresh token is stored",
    async (provider) => {
      const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
        ...scope,
        provider,
        tokens: { accessToken: "stale" },
      });
      expect(outcome).toMatchObject({ status: "RECONNECT_REQUIRED" });
      expect(prisma.socialConnection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "REAUTH_REQUIRED" }),
        }),
      );
    },
  );

  it("exchanges the Meta access token without needing a refresh token", async () => {
    const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
      ...scope,
      provider: "FACEBOOK",
      tokens: { accessToken: "long-lived" },
    });
    expect(outcome).toMatchObject({ status: "REFRESHED" });
    expect(meta.refreshAccessToken).toHaveBeenCalledWith({ accessToken: "long-lived" });
  });

  it("converts a provider refresh failure into a reconnect-required state", async () => {
    meta.refreshAccessToken.mockRejectedValue(new Error("Meta rejected the exchange."));
    const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
      ...scope,
      provider: "INSTAGRAM",
      tokens: { accessToken: "stale" },
    });
    expect(outcome).toEqual({
      status: "RECONNECT_REQUIRED",
      reason: "Meta rejected the exchange.",
    });
    expect(credentials.upsertTokens).not.toHaveBeenCalled();
  });

  it("refuses to touch a connection outside the analytics tenant scope", async () => {
    prisma.socialConnection.findFirst.mockResolvedValue(null);
    const outcome = await socialAnalyticsCredentialService.refreshForAnalytics({
      ...scope,
      organisationId: "org-2",
      provider: "INSTAGRAM",
      tokens: { accessToken: "stale" },
    });
    expect(outcome).toMatchObject({ status: "RECONNECT_REQUIRED" });
    expect(meta.refreshAccessToken).not.toHaveBeenCalled();
    expect(prisma.socialConnection.updateMany).not.toHaveBeenCalled();
  });

  it("scopes the reconnect update to the owning organisation and brand", async () => {
    await socialAnalyticsCredentialService.markReconnectRequired({
      ...scope,
      reason: "Manual",
    });
    expect(prisma.socialConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "connection-1", organisationId: "org-1", brandId: "brand-1" },
      }),
    );
  });
});
