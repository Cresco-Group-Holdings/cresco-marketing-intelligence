import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { resolveProviderOAuthAdapter } from "@/server/providers/oauth/oauth-adapter-factory";
import { PRODUCTION_OAUTH_PROVIDER_KEYS } from "@/lib/providers/oauth/production-providers";

vi.mock("@/lib/providers/oauth/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/oauth/runtime")>();
  return {
    ...actual,
    isOAuthMockAllowed: vi.fn(actual.isOAuthMockAllowed),
  };
});

import { isOAuthMockAllowed } from "@/lib/providers/oauth/runtime";

describe("oauth adapter factory", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    vi.mocked(isOAuthMockAllowed).mockImplementation(() => process.env.NODE_ENV === "test");
    delete process.env.ALLOW_OAUTH_MOCK;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    vi.stubEnv("NODE_ENV", "test");
  });

  it("returns real Meta adapter when credentials are configured", () => {
    process.env.META_APP_ID = "meta_app_id";
    process.env.META_APP_SECRET = "meta_app_secret";
    resetEnvCacheForTests();

    const adapter = resolveProviderOAuthAdapter("meta");
    expect(adapter.providerKey).toBe("meta");
    expect(adapter.getConfigStatus()).toBe("READY");
    expect(adapter.buildAuthorizationUrl({
      redirectUri: "https://app.example.com/api/integrations/oauth/meta/callback",
      state: "state_123",
      scopes: ["pages_show_list"],
    })).toContain("facebook.com");
  });

  it("returns real Google Analytics adapter when credentials are configured", () => {
    process.env.GOOGLE_CLIENT_ID = "google_id";
    process.env.GOOGLE_CLIENT_SECRET = "google_secret";
    resetEnvCacheForTests();

    const adapter = resolveProviderOAuthAdapter("google-analytics");
    expect(adapter.providerKey).toBe("google-analytics");
    expect(adapter.buildAuthorizationUrl({
      redirectUri: "https://app.example.com/callback",
      state: "state_123",
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    })).toContain("accounts.google.com");
  });

  it("throws for production providers without credentials when mock is disallowed", () => {
    vi.mocked(isOAuthMockAllowed).mockReturnValue(false);
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    resetEnvCacheForTests();

    for (const providerKey of PRODUCTION_OAUTH_PROVIDER_KEYS) {
      expect(() => resolveProviderOAuthAdapter(providerKey)).toThrow(/misconfigured/i);
    }
  });

  it("allows mock adapter for production providers only when explicitly opted in", () => {
    vi.mocked(isOAuthMockAllowed).mockReturnValue(true);
    vi.stubEnv("NODE_ENV", "development");
    process.env.ALLOW_OAUTH_MOCK = "true";
    resetEnvCacheForTests();

    const adapter = resolveProviderOAuthAdapter("meta");
    expect(adapter.providerKey).toBe("meta");
    expect(adapter.buildAuthorizationUrl({
      redirectUri: "https://app.example.com/callback",
      state: "state_123",
      scopes: ["pages_show_list"],
    })).toContain("mode=mock");
  });

  it("rejects non-production providers without mock opt-in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
    delete process.env.ALLOW_OAUTH_MOCK;
    resetEnvCacheForTests();

    expect(() => resolveProviderOAuthAdapter("hubspot")).toThrow(/not production-enabled/i);
  });
});
