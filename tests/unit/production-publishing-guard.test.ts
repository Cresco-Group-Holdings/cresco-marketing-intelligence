import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { resolvePlatformAdapter } from "@/lib/providers/platform-registry";
import { isPlatformAdapterUsingMock } from "@/lib/providers/platform-registry";

describe("production publishing mock prohibition", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.ALLOW_PUBLISHING_MOCK;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VITEST", "false");
  });

  it("resolves real meta adapter in production", () => {
    const adapter = resolvePlatformAdapter({
      providerKey: "meta",
      apiVersion: "v19.0",
      capability: "SOCIAL_CONTENT_PUBLISH",
    });
    expect(adapter.providerKey).toBe("meta");
    expect(isPlatformAdapterUsingMock("meta")).toBe(false);
  });

  it("rejects mock-social in production", () => {
    expect(() =>
      resolvePlatformAdapter({
        providerKey: "mock-social",
        capability: "SOCIAL_CONTENT_PUBLISH",
      }),
    ).toThrow();
  });
});
