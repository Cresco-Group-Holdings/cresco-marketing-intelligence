import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { resolveProviderOAuthAdapter } from "@/server/providers/oauth/oauth-adapter-factory";
import { PRODUCTION_OAUTH_PROVIDER_KEYS } from "@/lib/providers/oauth/production-providers";

describe("oauth adapter factory", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.ALLOW_OAUTH_MOCK;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    vi.stubEnv("NODE_ENV", "test");
  });

  it("returns real Meta adapter when credentials are configured", () => {
    process.env.META_APP_ID = "meta_app_id";
    process.env.META_APP_SECRET = "meta_app_secret";

    const adapter = resolveProviderOAuthAdapter("meta");
    expect(adapter.providerKey).toBe("meta");
    expect(adapter.getConfigStatus()).toBe("READY");
    expect(adapter.buildAuthorizationUrl({
      redirectUri: "https://app.example.com/api/integrations/oauth/meta/callback",
      state: "state_123",
      scopes: ["pages_show_list"],
    })).toContain("facebook.com");
  });

  it("throws for production providers without credentials when mock is disallowed", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
    delete process.env.ALLOW_OAUTH_MOCK;
    resetEnvCacheForTests();

    for (const providerKey of PRODUCTION_OAUTH_PROVIDER_KEYS) {
      expect(() => resolveProviderOAuthAdapter(providerKey)).toThrow(/misconfigured/i);
    }
  });

  it("allows mock adapter for production providers only when explicitly opted in", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.ALLOW_OAUTH_MOCK = "true";

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

    expect(() => resolveProviderOAuthAdapter("google-analytics")).toThrow(/not production-enabled/i);
  });
});
