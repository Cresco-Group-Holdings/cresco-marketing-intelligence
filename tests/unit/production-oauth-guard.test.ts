import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { PRODUCTION_OAUTH_PROVIDER_KEYS } from "@/lib/providers/oauth/production-providers";
import { resolveProviderOAuthAdapter } from "@/server/providers/oauth/oauth-adapter-factory";
import { createMockOAuthAdapter } from "@/server/providers/oauth/adapters/mock-oauth-adapter";

describe("production oauth mock prohibition", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.ALLOW_OAUTH_MOCK;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
    resetEnvCacheForTests();
  });

  it("never resolves production providers to mock adapters in production", () => {
    process.env.META_APP_ID = "meta_app_id";
    process.env.META_APP_SECRET = "meta_app_secret";
    resetEnvCacheForTests();

    for (const providerKey of PRODUCTION_OAUTH_PROVIDER_KEYS) {
      const adapter = resolveProviderOAuthAdapter(providerKey);
      const mockAdapter = createMockOAuthAdapter(providerKey);
      const productionUrl = adapter.buildAuthorizationUrl({
        redirectUri: "https://app.example.com/callback",
        state: "state",
        scopes: ["pages_show_list"],
      });
      const mockUrl = mockAdapter.buildAuthorizationUrl({
        redirectUri: "https://app.example.com/callback",
        state: "state",
        scopes: ["pages_show_list"],
      });

      expect(productionUrl).not.toBe(mockUrl);
      expect(productionUrl).not.toContain("mode=mock");
    }
  });

  it("fails closed for production providers without credentials", () => {
    expect(() => resolveProviderOAuthAdapter("meta")).toThrow();
    expect(() => resolveProviderOAuthAdapter("meta-ads")).toThrow();
  });
});
