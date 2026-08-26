import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@/lib/environment";
import {
  buildProviderTruthContract,
  getCustomerConnectableLaunchMinimum,
  getEngineeringLaunchMinimum,
  listLaunchProviderTruthContracts,
} from "@/lib/providers/provider-truth-contract";

describe("provider truth contract", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    vi.stubEnv("NODE_ENV", "test");
  });

  it("separates engineering readiness from customer availability when credentials are missing", () => {
    const truth = buildProviderTruthContract("linkedin");

    expect(truth.engineeringStatus).toBe("ready");
    expect(truth.configurationStatus).toBe("misconfigured");
    expect(truth.customerAvailability).toBe("not_configured");
  });

  it("returns pending_provider_approval when configured but external approval is missing", () => {
    process.env.LINKEDIN_CLIENT_ID = "linkedin-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    resetEnvCacheForTests();

    const truth = buildProviderTruthContract("linkedin");
    expect(truth.configurationStatus).toBe("ready");
    expect(truth.externalApprovalStatus).toBe("pending_approval");
    expect(truth.customerAvailability).toBe("pending_provider_approval");
  });

  it("returns available when credentials and external approval are configured", () => {
    process.env.LINKEDIN_CLIENT_ID = "linkedin-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-secret";
    process.env.PROVIDER_LINKEDIN_EXTERNAL_APPROVED = "true";
    resetEnvCacheForTests();

    const truth = buildProviderTruthContract("linkedin");
    expect(truth.customerAvailability).toBe("available");
  });

  it("marks TikTok as post-launch unavailable", () => {
    const truth = buildProviderTruthContract("tiktok");
    expect(truth.engineeringStatus).toBe("planned");
    expect(truth.customerAvailability).toBe("unavailable");
  });

  it("maps connection status separately from product availability", () => {
    const truth = buildProviderTruthContract("linkedin", {
      connection: {
        status: "REAUTH_REQUIRED",
        hasSelectedAccount: true,
      },
    });

    expect(truth.connectionStatus).toBe("reauthentication_required");
    expect(truth.customerAvailability).toBe("not_configured");
  });

  it("exposes engineering vs customer launch minimum sets", () => {
    const engineering = getEngineeringLaunchMinimum();
    expect(engineering).toContain("linkedin");
    expect(engineering).not.toContain("tiktok");

    process.env.GOOGLE_CLIENT_ID = "g";
    process.env.GOOGLE_CLIENT_SECRET = "s";
    process.env.META_APP_ID = "m";
    process.env.META_APP_SECRET = "ms";
    process.env.LINKEDIN_CLIENT_ID = "l";
    process.env.LINKEDIN_CLIENT_SECRET = "ls";
    process.env.PROVIDER_GOOGLE_ANALYTICS_EXTERNAL_APPROVED = "true";
    process.env.PROVIDER_META_EXTERNAL_APPROVED = "true";
    process.env.PROVIDER_LINKEDIN_EXTERNAL_APPROVED = "true";
    resetEnvCacheForTests();

    const connectable = getCustomerConnectableLaunchMinimum();
    expect(connectable).toContain("google-analytics");
    expect(connectable).toContain("meta");
    expect(connectable).toContain("linkedin");
    expect(connectable).not.toContain("tiktok");
  });

  it("lists truth contracts for all launch providers", () => {
    const contracts = listLaunchProviderTruthContracts();
    expect(contracts.some((row) => row.providerKey === "google-analytics")).toBe(true);
    expect(contracts.every((row) => row.capabilities.length >= 0)).toBe(true);
  });
});
