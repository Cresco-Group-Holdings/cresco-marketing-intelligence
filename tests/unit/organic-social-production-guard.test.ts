import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { resolvePlatformAdapter } from "@/lib/providers/platform-registry";

describe("organic social production adapter resolution", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.ALLOW_PUBLISHING_MOCK;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
  });

  it("resolves meta to real publishing adapter in production", () => {
    const adapter = resolvePlatformAdapter({
      providerKey: "meta",
      apiVersion: "v19.0",
      capability: "SOCIAL_CONTENT_PUBLISH",
    });
    expect(adapter.providerKey).toBe("meta");
    expect(adapter.getCapabilities().some((c) => c.key === "SOCIAL_CONTENT_PUBLISH")).toBe(true);
  });

  it("blocks mock-social in production runtime", () => {
    expect(() =>
      resolvePlatformAdapter({
        providerKey: "mock-social",
        capability: "SOCIAL_CONTENT_PUBLISH",
      }),
    ).toThrow();
  });
});
