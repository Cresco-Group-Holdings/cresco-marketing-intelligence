import type { CanonicalCrmCompany, CanonicalCrmContact } from "@/lib/providers/canonical/contracts";
import type {
  NormalisedWebhookEvent,
  PlatformProviderAdapter,
  ProviderConnectionHealth,
  ProviderExecutionContext,
  ProviderOperation,
  ProviderOperationResult,
  ProviderValidationResult,
  WebhookHandlingResult,
} from "@/lib/providers/platform-adapter";
import { MOCK_CRM_CAPABILITIES } from "@/lib/providers/capability-registry";

const MOCK_CONTACTS: CanonicalCrmContact[] = [
  {
    externalId: "mock-contact-1",
    providerKey: "mock-crm",
    displayName: "Alex Smith",
    email: "alex@example.com",
    companyName: "Acme Ltd",
    sourceUpdatedAt: new Date().toISOString(),
  },
];

const MOCK_COMPANIES: CanonicalCrmCompany[] = [
  {
    externalId: "mock-company-1",
    providerKey: "mock-crm",
    name: "Acme Ltd",
    domain: "acme.example",
    sourceUpdatedAt: new Date().toISOString(),
  },
];

const processedWebhookIds = new Set<string>();

export function createMockCrmAdapter(): PlatformProviderAdapter {
  return {
    providerKey: "mock-crm",
    apiVersion: "1.0-test",

    getCapabilities() {
      return MOCK_CRM_CAPABILITIES.map((key) => ({
        key,
        direction: key.includes("WRITE") ? ("WRITE" as const) : ("READ" as const),
        resourceType: key.split("_").slice(1).join("_").toLowerCase(),
      }));
    },

    async validateConfiguration(): Promise<ProviderValidationResult> {
      return { valid: true, errors: [] };
    },

    async verifyConnection(): Promise<ProviderConnectionHealth> {
      return {
        status: "HEALTHY",
        checkedAt: new Date().toISOString(),
        capabilitiesAvailable: [...MOCK_CRM_CAPABILITIES],
        capabilitiesUnavailable: [],
        warnings: [{ code: "TEST_ADAPTER", message: "This is a non-production reference adapter." }],
      };
    },

    async execute<TInput, TOutput>(
      operation: ProviderOperation<TInput>,
      _context: ProviderExecutionContext,
    ): Promise<ProviderOperationResult<TOutput>> {
      const input = operation.input as { cursor?: string; updatedSince?: string };

      switch (operation.operation) {
        case "listContacts": {
          const filtered = input.updatedSince
            ? MOCK_CONTACTS.filter((c) => (c.sourceUpdatedAt ?? "") >= input.updatedSince!)
            : MOCK_CONTACTS;
          return { success: true, data: { contacts: filtered, nextCursor: undefined } as TOutput };
        }
        case "listCompanies":
          return { success: true, data: { companies: MOCK_COMPANIES, nextCursor: undefined } as TOutput };
        default:
          return {
            success: false,
            errorCode: "PROVIDER_CAPABILITY_UNSUPPORTED",
            errorMessageSafe: `Unsupported operation: ${operation.operation}`,
            retryable: false,
          };
      }
    },

    async handleWebhook(
      event: NormalisedWebhookEvent,
      _context: ProviderExecutionContext,
    ): Promise<WebhookHandlingResult> {
      if (processedWebhookIds.has(event.providerEventId)) {
        return { status: "IGNORED" };
      }
      processedWebhookIds.add(event.providerEventId);
      return { status: "PROCESSED" };
    },
  };
}

export function resetMockCrmAdapterState() {
  processedWebhookIds.clear();
}
