import type {
  CanonicalExternalAccount,
  CanonicalExternalCampaign,
  CanonicalAnalyticsMetric,
} from "@/lib/providers/canonical/contracts";
import type {
  PlatformProviderAdapter,
  ProviderConnectionHealth,
  ProviderExecutionContext,
  ProviderOperation,
  ProviderOperationResult,
  ProviderValidationResult,
} from "@/lib/providers/platform-adapter";
import { MOCK_ADVERTISING_CAPABILITIES } from "@/lib/providers/capability-registry";

const MOCK_CAMPAIGNS: CanonicalExternalCampaign[] = [
  {
    externalId: "mock-camp-1",
    providerKey: "mock-advertising",
    providerAccountId: "mock-acct-1",
    name: "Spring Launch",
    status: "ACTIVE",
    objective: "AWARENESS",
    dailyBudget: 100,
    currency: "GBP",
  },
  {
    externalId: "mock-camp-2",
    providerKey: "mock-advertising",
    providerAccountId: "mock-acct-1",
    name: "Retargeting",
    status: "PAUSED",
    objective: "CONVERSIONS",
    dailyBudget: 50,
    currency: "GBP",
  },
];

const MOCK_ACCOUNTS: CanonicalExternalAccount[] = [
  {
    externalId: "mock-acct-1",
    providerKey: "mock-advertising",
    displayName: "Mock Ad Account",
    accountType: "AD_ACCOUNT",
    currency: "GBP",
    timezone: "Europe/London",
    status: "ACTIVE",
  },
];

let requestCount = 0;

export function createMockAdvertisingAdapter(): PlatformProviderAdapter {
  return {
    providerKey: "mock-advertising",
    apiVersion: "1.0-test",

    getCapabilities() {
      return MOCK_ADVERTISING_CAPABILITIES.map((key) => ({
        key,
        direction: "READ" as const,
        resourceType: key.split("_").slice(1).join("_").toLowerCase(),
      }));
    },

    async validateConfiguration(): Promise<ProviderValidationResult> {
      return { valid: true, errors: [] };
    },

    async verifyConnection(_context: ProviderExecutionContext): Promise<ProviderConnectionHealth> {
      return {
        status: "HEALTHY",
        checkedAt: new Date().toISOString(),
        capabilitiesAvailable: [...MOCK_ADVERTISING_CAPABILITIES],
        capabilitiesUnavailable: [],
        warnings: [{ code: "TEST_ADAPTER", message: "This is a non-production reference adapter." }],
      };
    },

    async execute<TInput, TOutput>(
      operation: ProviderOperation<TInput>,
      _context: ProviderExecutionContext,
    ): Promise<ProviderOperationResult<TOutput>> {
      requestCount += 1;

      if (requestCount % 20 === 0) {
        return {
          success: false,
          errorCode: "PROVIDER_RATE_LIMITED",
          errorMessageSafe: "Mock rate limit simulated.",
          retryable: true,
          rateLimit: { retryAfterMs: 1000, remaining: 0 },
        };
      }

      const token = await _context.decryptCredential("API_KEY");
      if (token === "expired-token") {
        return {
          success: false,
          errorCode: "PROVIDER_AUTH_FAILED",
          errorMessageSafe: "Mock token expired.",
          retryable: false,
        };
      }

      switch (operation.operation) {
        case "listAccounts":
          return { success: true, data: { accounts: MOCK_ACCOUNTS, nextCursor: undefined } as TOutput };
        case "listCampaigns": {
          const input = operation.input as { cursor?: string; pageSize?: number };
          const pageSize = input.pageSize ?? 1;
          const start = input.cursor ? Number(input.cursor) : 0;
          const page = MOCK_CAMPAIGNS.slice(start, start + pageSize);
          const nextCursor = start + pageSize < MOCK_CAMPAIGNS.length ? String(start + pageSize) : undefined;
          return { success: true, data: { campaigns: page, nextCursor } as TOutput };
        }
        case "getCampaignMetrics": {
          const metrics: CanonicalAnalyticsMetric[] = [
            {
              externalId: "mock-metric-1",
              providerKey: "mock-advertising",
              metricName: "impressions",
              value: 12000,
              date: new Date().toISOString().slice(0, 10),
            },
          ];
          return { success: true, data: { metrics } as TOutput };
        }
        default:
          return {
            success: false,
            errorCode: "PROVIDER_CAPABILITY_UNSUPPORTED",
            errorMessageSafe: `Unsupported operation: ${operation.operation}`,
            retryable: false,
          };
      }
    },
  };
}

export function resetMockAdvertisingAdapterState() {
  requestCount = 0;
}
