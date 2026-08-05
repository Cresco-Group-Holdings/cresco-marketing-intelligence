import { beforeEach, describe, expect, it } from "vitest";
import {
  CANONICAL_PROVIDER_CAPABILITIES,
  isCanonicalCapability,
  listProviderCapabilities,
  providerSupportsCapability,
} from "@/lib/providers/capability-registry";
import {
  PROVIDER_ERROR_CODES,
  ProviderGatewayError,
  mapErrorToProviderCode,
} from "@/lib/providers/errors";
import {
  resolvePlatformAdapter,
  resetPlatformAdapterCacheForTests,
} from "@/lib/providers/platform-registry";
import { resetMockAdvertisingAdapterState } from "@/server/providers/mock-advertising/mock-advertising-adapter";

describe("provider integration platform", () => {
  beforeEach(() => {
    resetPlatformAdapterCacheForTests();
    resetMockAdvertisingAdapterState();
  });

  describe("capability registry", () => {
    it("includes canonical advertising and CRM capabilities", () => {
      expect(CANONICAL_PROVIDER_CAPABILITIES).toContain("AD_CAMPAIGNS_READ");
      expect(CANONICAL_PROVIDER_CAPABILITIES).toContain("CRM_CONTACTS_READ");
      expect(CANONICAL_PROVIDER_CAPABILITIES).toContain("WEBHOOKS_RECEIVE");
    });

    it("validates canonical capability keys", () => {
      expect(isCanonicalCapability("AD_CAMPAIGNS_READ")).toBe(true);
      expect(isCanonicalCapability("NOT_A_CAPABILITY")).toBe(false);
    });

    it("lists mock provider capabilities", () => {
      expect(listProviderCapabilities("mock-advertising")).toEqual([
        "AD_ACCOUNTS_READ",
        "AD_CAMPAIGNS_READ",
        "AD_INSIGHTS_READ",
      ]);
      expect(providerSupportsCapability("mock-crm", "CRM_CONTACTS_READ")).toBe(true);
      expect(providerSupportsCapability("mock-crm", "AD_CAMPAIGNS_READ")).toBe(false);
    });
  });

  describe("platform adapter registry", () => {
    it("resolves mock advertising adapter by provider key and version", () => {
      const adapter = resolvePlatformAdapter({
        providerKey: "mock-advertising",
        apiVersion: "1.0-test",
        capability: "AD_CAMPAIGNS_READ",
      });
      expect(adapter.providerKey).toBe("mock-advertising");
      expect(adapter.apiVersion).toBe("1.0-test");
      expect(adapter.getCapabilities().map((item) => item.key)).toContain("AD_CAMPAIGNS_READ");
    });

    it("rejects unknown providers", () => {
      expect(() =>
        resolvePlatformAdapter({ providerKey: "unknown-provider", apiVersion: "1.0" }),
      ).toThrow(ProviderGatewayError);
    });

    it("rejects unsupported capabilities", () => {
      expect(() =>
        resolvePlatformAdapter({
          providerKey: "mock-advertising",
          apiVersion: "1.0-test",
          capability: "CRM_CONTACTS_READ",
        }),
      ).toThrow(ProviderGatewayError);
    });

    it("rejects unsupported API versions", () => {
      expect(() =>
        resolvePlatformAdapter({
          providerKey: "mock-advertising",
          apiVersion: "99.0",
          capability: "AD_CAMPAIGNS_READ",
        }),
      ).toThrow(ProviderGatewayError);
    });
  });

  describe("canonical error mapping", () => {
    it("maps gateway errors to codes", () => {
      const error = new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED,
        safeMessage: "Rate limited.",
        retryable: true,
      });
      expect(mapErrorToProviderCode(error)).toBe(PROVIDER_ERROR_CODES.PROVIDER_RATE_LIMITED);
    });

    it("maps auth failures from message text", () => {
      expect(mapErrorToProviderCode(new Error("401 unauthorized"))).toBe(
        PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED,
      );
    });

    it("exposes safe messages without secrets", () => {
      const error = new ProviderGatewayError({
        code: PROVIDER_ERROR_CODES.PROVIDER_AUTH_FAILED,
        safeMessage: "Authentication failed.",
      });
      expect(error.safeMessage).not.toMatch(/token|secret|key/i);
      expect(error.code).toBe("PROVIDER_AUTH_FAILED");
    });
  });

  describe("mock advertising adapter behaviour", () => {
    it("returns paginated campaigns", async () => {
      const adapter = resolvePlatformAdapter({
        providerKey: "mock-advertising",
        apiVersion: "1.0-test",
      });

      const page1 = await adapter.execute(
        {
          capability: "AD_CAMPAIGNS_READ",
          operation: "listCampaigns",
          input: { pageSize: 1 },
        },
        {
          organisationId: "org-1",
          connectionId: "conn-1",
          providerKey: "mock-advertising",
          apiVersion: "1.0-test",
          configuration: {},
          correlationId: "corr-1",
          decryptCredential: async () => "valid-token",
        },
      );

      expect(page1.success).toBe(true);
      const data = page1.data as { campaigns: unknown[]; nextCursor?: string };
      expect(data.campaigns).toHaveLength(1);
      expect(data.nextCursor).toBe("1");
    });

    it("simulates token expiry for invalid credentials", async () => {
      const adapter = resolvePlatformAdapter({
        providerKey: "mock-advertising",
        apiVersion: "1.0-test",
      });

      const result = await adapter.execute(
        {
          capability: "AD_CAMPAIGNS_READ",
          operation: "listCampaigns",
          input: {},
        },
        {
          organisationId: "org-1",
          connectionId: "conn-1",
          providerKey: "mock-advertising",
          apiVersion: "1.0-test",
          configuration: {},
          correlationId: "corr-2",
          decryptCredential: async () => "expired-token",
        },
      );

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("PROVIDER_AUTH_FAILED");
      expect(result.retryable).toBe(false);
    });

    it("reports healthy connection with test adapter warning", async () => {
      const adapter = resolvePlatformAdapter({
        providerKey: "mock-advertising",
        apiVersion: "1.0-test",
      });

      const health = await adapter.verifyConnection({
        organisationId: "org-1",
        connectionId: "conn-1",
        providerKey: "mock-advertising",
        apiVersion: "1.0-test",
        configuration: {},
        correlationId: "corr-3",
        decryptCredential: async () => "valid-token",
      });

      expect(health.status).toBe("HEALTHY");
      expect(health.warnings.some((warning) => warning.code === "TEST_ADAPTER")).toBe(true);
    });
  });
});
