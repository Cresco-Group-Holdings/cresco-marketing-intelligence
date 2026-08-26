import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  isProductionOAuthReady,
  isProviderConnectableInProduction,
  resolveOAuthProviderKey,
  resolveProviderProductAvailability,
} from "@/lib/providers/provider-availability";

describe("provider availability", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    vi.stubEnv("NODE_ENV", "test");
  });

  it("maps facebook and instagram to meta oauth", () => {
    expect(resolveOAuthProviderKey("facebook")).toBe("meta");
    expect(resolveOAuthProviderKey("instagram")).toBe("meta");
    expect(resolveOAuthProviderKey("linkedin")).toBe("linkedin");
  });

  it("returns not_configured when credentials are missing", () => {
    expect(resolveProviderProductAvailability("google-analytics")).toBe("not_configured");
    expect(isProviderConnectableInProduction("google-analytics")).toBe(false);
  });

  it("returns available when credentials are configured", () => {
    process.env.GOOGLE_CLIENT_ID = "google-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-secret";
    resetEnvCacheForTests();

    expect(resolveProviderProductAvailability("google-analytics")).toBe("available");
    expect(isProductionOAuthReady("google-analytics")).toBe(true);
    expect(isProviderConnectableInProduction("google-analytics")).toBe(true);
  });

  it("returns beta for x when configured", () => {
    process.env.X_CLIENT_ID = "x-id";
    process.env.X_CLIENT_SECRET = "x-secret";
    resetEnvCacheForTests();

    expect(resolveProviderProductAvailability("x")).toBe("beta");
    expect(isProviderConnectableInProduction("x")).toBe(true);
  });
});
