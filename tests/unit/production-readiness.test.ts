import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import { buildProviderReadinessMatrix } from "@/lib/providers/production-readiness";

describe("production readiness matrix", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    vi.stubEnv("NODE_ENV", "test");
  });

  it("lists tier 1 providers with adapter registration", () => {
    const matrix = buildProviderReadinessMatrix();
    const keys = matrix.map((row) => row.providerKey);
    expect(keys).toContain("google-analytics");
    expect(keys).toContain("meta");
    expect(keys).toContain("linkedin");
    expect(keys).toContain("youtube");
    expect(keys).toContain("x");
  });

  it("marks providers not_configured without env", () => {
    const meta = buildProviderReadinessMatrix().find((row) => row.providerKey === "meta");
    expect(meta?.productionStatus).toBe("not_configured");
    expect(meta?.envConfigured).toBe(false);
  });
});
