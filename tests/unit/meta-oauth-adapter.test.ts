import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { metaOAuthAdapter } from "@/server/providers/oauth/adapters/meta-oauth-adapter";

describe("meta oauth adapter", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    process.env.META_APP_ID = "meta_app_id";
    process.env.META_APP_SECRET = "meta_app_secret";
    vi.restoreAllMocks();
  });

  it("builds authorization URL with configured app id and scopes", () => {
    const url = metaOAuthAdapter.buildAuthorizationUrl({
      redirectUri: "https://app.example.com/api/integrations/oauth/meta/callback",
      state: "state_token",
      scopes: ["pages_show_list", "instagram_basic"],
    });

    expect(url).toContain("facebook.com");
    expect(url).toContain("client_id=meta_app_id");
    expect(url).toContain("state=state_token");
    expect(url).toContain("pages_show_list");
  });

  it("exchanges authorization code via short-lived then long-lived token flow", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "short_token", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "long_token", expires_in: 5184000 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "user_123", name: "Test User" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await metaOAuthAdapter.exchangeAuthorizationCode({
      code: "auth_code_abc",
      redirectUri: "https://app.example.com/api/integrations/oauth/meta/callback",
    });

    expect(result.accessToken).toBe("long_token");
    expect(result.refreshToken).toBe("long_token");
    expect(result.externalAccountId).toBe("user_123");
    expect(result.externalLabel).toBe("Test User");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes tokens using fb_exchange_token grant", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "refreshed_token", expires_in: 5184000 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "user_123", name: "Test User" }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await metaOAuthAdapter.refreshAccessToken({ refreshToken: "existing_token" });
    expect(result.accessToken).toBe("refreshed_token");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("fb_exchange_token");
  });

  it("reports misconfigured when env vars are missing", () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    resetEnvCacheForTests();
    expect(metaOAuthAdapter.getConfigStatus()).toBe("MISCONFIGURED");
  });
});
