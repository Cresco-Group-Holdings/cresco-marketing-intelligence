/** Harness version stamped into certification reports. */
export const GOLDEN_JOURNEY_HARNESS_VERSION = "task-5.0.0";

/** Safe tenant aliases used in reports — never real customer identifiers. */
export const GOLDEN_TENANT_ALIASES = {
  primary: "golden-tenant-alpha",
  secondary: "golden-tenant-beta",
} as const;

/** External boundaries that may be mocked in golden journeys. */
export const GOLDEN_PROVIDER_MOCK_BOUNDARIES = [
  "oauthAdapterRegistry",
  "providerGateway.execute",
  "credentialVault",
  "stripe-webhook-signature",
  "aiRequestService.executeStructured",
] as const;
