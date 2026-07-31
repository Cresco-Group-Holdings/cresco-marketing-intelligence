# Provider Adapter Guide

How to implement provider adapters for Task 7.2+. Task 7.1 defines contracts and registry; adapters are not yet registered (`resolveProviderAdapter()` returns `null`).

## Before You Start

1. Read [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md) for the service layer and flow.
2. Confirm the provider definition exists in `src/lib/providers/definitions.ts`.
3. Complete [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md) before enabling the provider.
4. Set `PROVIDER_LIVE_CALLS_ENABLED=true` only in the target environment after adapter testing.

## Adapter Architecture

```
src/lib/providers/adapters/
  {provider-key}/
    index.ts              # Main adapter export
    oauth.ts              # OAuth methods (if applicable)
    webhook.ts            # Webhook methods (if applicable)
    types.ts              # Provider-specific types
```

Register in `src/lib/providers/registry.ts`:

```typescript
export function resolveProviderAdapter(providerKey: string, capability?: ProviderCapabilityType) {
  // Task 7.2+: return adapter instance based on providerKey + capability
  const adapter = adapterRegistry.get(providerKey);
  return adapter ?? null;
}
```

## Base Adapter

Every adapter implements `ProviderAdapter`:

```typescript
import type { ProviderAdapter, ProviderAdapterContext } from "@/lib/providers/adapter-contracts";

export class ExampleAdapter implements ProviderAdapter {
  readonly providerKey = "example" as const;

  validateConfiguration(config: ProviderConfiguration) {
    return validateProviderConfiguration(this.providerKey, config);
  }

  async testConnection(context: ProviderAdapterContext): Promise<ProviderTestResult> {
    assertProviderLiveCallsEnabled();
    // Call provider API with stored credentials
    return { success: true, message: "Connection verified." };
  }

  getCapabilities() {
    return getProviderDefinition(this.providerKey)!.capabilities;
  }

  async getHealth(context: ProviderAdapterContext): Promise<ProviderHealthResult> {
    // Lightweight API call or token validation
    return { status: "HEALTHY", checkedAt: new Date().toISOString() };
  }
}
```

### Context Object

```typescript
type ProviderAdapterContext = {
  organisationId: string;
  connectionId: string;
  providerKey: ProviderKey;
  configuration: ProviderConfiguration;  // non-secret config from connection
  correlationId?: string;
};
```

Retrieve credentials inside adapter methods:

```typescript
const token = await providerCredentialService.getCredentialPlaintext(
  context.connectionId,
  "OAUTH_ACCESS_TOKEN",
);
```

Never pass credentials through the context object.

## Capability-Specific Interfaces

Implement only the interfaces matching the provider's capabilities in the registry.

### OAuthProviderAdapter

For providers with `OAUTH_CONNECT` capability and `OAUTH2_*` auth types.

```typescript
interface OAuthProviderAdapter extends ProviderAdapter {
  createAuthorizationUrl(input: {
    context: ProviderAdapterContext;
    redirectUri: string;
    state: string;
    codeChallenge?: string;
    scopes: string[];
  }): Promise<{ url: string }>;

  exchangeAuthorizationCode(input: {
    context: ProviderAdapterContext;
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
    grantedScopes: string[];
    externalAccountId?: string;
    externalLabel?: string;
  }>;

  refreshAccessToken(input: {
    context: ProviderAdapterContext;
    refreshToken: string;
  }): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }>;

  revokeConnection(context: ProviderAdapterContext): Promise<void>;
}
```

**Integration with OAuth service**: Replace the stub URL in `providerOAuthService.startAuthorization()` with `adapter.createAuthorizationUrl()`. Wire callback route to `adapter.exchangeAuthorizationCode()`.

**PKCE**: Check `definition.authType === "OAUTH2_PKCE"` — pass `codeChallenge` in authorize URL and `codeVerifier` in token exchange.

### ApiKeyProviderAdapter

For `API_KEY`, `BEARER_TOKEN` auth types.

```typescript
interface ApiKeyProviderAdapter extends ProviderAdapter {
  validateApiKey(apiKey: string): Promise<ProviderTestResult>;
}
```

Call during connection setup before storing the key.

### WebhookProviderAdapter

For providers with `WEBHOOK_INGEST` or `EMAIL_WEBHOOK` capability.

```typescript
interface WebhookProviderAdapter {
  readonly providerKey: ProviderKey;
  verifyWebhookSignature(input: {
    rawBody: string;
    headers: Record<string, string | undefined>;
    secret: string;
  }): boolean;
  extractEventId(payload: unknown): string | null;
  extractEventType(payload: unknown): string | null;
  normalizeWebhookEvent(payload: unknown): Record<string, unknown>;
}
```

Use foundation helpers where possible:

```typescript
import { verifyHmacWebhookSignature } from "@/lib/providers/webhook/verification";

// Default HMAC-SHA256 (Meta, Resend, etc.)
verifyWebhookSignature({ rawBody, headers, secret }) {
  return verifyHmacWebhookSignature({
    rawBody,
    signature: headers["x-signature"] ?? "",
    secret,
  });
}

// Custom scheme (Stripe, etc.)
verifyWebhookSignature({ rawBody, headers, secret }) {
  // Provider-specific: parse Stripe-Signature header, construct signed payload
}
```

Type guard: `isWebhookProviderAdapter(adapter)`.

### PullProviderAdapter

For `ANALYTICS_PULL`, `PAYMENT_SYNC`, `SEARCH_RANK`, `DATA_IMPORT`, `CRAWL`.

```typescript
interface PullProviderAdapter extends ProviderAdapter {
  pull(input: {
    context: ProviderAdapterContext;
    resourceType: string;
    cursor?: string;
  }): Promise<{ records: unknown[]; nextCursor?: string }>;
}
```

Store cursors in `ProviderSyncCursor` via sync service (7.2+).

### PushProviderAdapter

For `PUBLISHING`, `ADVERTISING_MANAGE`, `EMAIL_SEND`.

```typescript
interface PushProviderAdapter extends ProviderAdapter {
  push(input: {
    context: ProviderAdapterContext;
    resourceType: string;
    payload: unknown;
    idempotencyKey?: string;
  }): Promise<{ externalId?: string }>;
}
```

Always accept and forward `idempotencyKey` to the provider when supported.

### Specialized Adapters

| Interface | Capability | Example Providers |
|-----------|-----------|-------------------|
| `AnalyticsProviderAdapter` | `ANALYTICS_PULL` | google-analytics, google-search-console |
| `PublishingProviderAdapter` | `PUBLISHING` | meta, linkedin, tiktok |
| `AdvertisingProviderAdapter` | `ADVERTISING_MANAGE` | google-ads, meta-ads |
| `EmailProviderAdapter` | `EMAIL_SEND` | resend, sendgrid |
| `PaymentProviderAdapter` | `PAYMENT_SYNC` | stripe |
| `SearchProviderAdapter` | `SEARCH_RANK` | licensed-rank-provider |

These extend pull/push base interfaces with domain-specific methods.

## Execution Policy

Use shared retry and error handling:

```typescript
import { withProviderRetry, normalizeProviderError, getProviderRequestTimeoutMs } from "@/lib/providers/execution-policy";

const result = await withProviderRetry(
  () => fetch(providerUrl, { signal: AbortSignal.timeout(getProviderRequestTimeoutMs()) }),
  { correlationId: context.correlationId },
);
```

Error classification:

| Classification | Retry | Example |
|---------------|-------|---------|
| `retryable` | Yes | Timeout, 503 |
| `rate_limited` | Yes (with backoff) | 429 |
| `non_retryable` | No | 401, 403, invalid request |

## Health Checks

`getHealth()` should be lightweight:

- Validate token is not expired.
- Make a minimal API call (e.g. `/me`, `/account`).
- Return `DEGRADED` for intermittent issues, `UNHEALTHY` for auth failures.

Update `ProviderHealthState` and connection status via service layer.

## Rate Limiting

If the provider returns rate limit headers:

1. Parse `Retry-After` or `X-RateLimit-Reset`.
2. Update `ProviderRateLimitState` for the connection.
3. Set connection `status: RATE_LIMITED` if limits are hit.
4. Audit: `RATE_LIMIT_REACHED`.

Implement `getRateLimitStatus()` on the adapter when the provider exposes rate limit APIs.

## Testing Adapters

### Unit Tests

Mock HTTP responses. Do not call live APIs in unit tests.

```typescript
describe("ExampleAdapter", () => {
  it("validates configuration", () => {
    const adapter = new ExampleAdapter();
    const result = adapter.validateConfiguration({ propertyId: "123" });
    expect(result.valid).toBe(true);
  });
});
```

### Integration Tests

Use provider sandbox credentials in CI (optional). Default: mock adapters.

### Manual Testing

1. Set `PROVIDER_LIVE_CALLS_ENABLED=true` in local env.
2. Create draft connection via API.
3. Complete OAuth flow (or submit API key).
4. Call `testConnection()`.
5. Verify audit events and credential fingerprints.

## Enabling a Provider

1. Implement adapter(s) for required capabilities.
2. Register in `resolveProviderAdapter()`.
3. Set `enabled: true` in `definitions.ts`.
4. Set `requiresApproval: false` (or complete approval workflow).
5. Configure environment variables per [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md).
6. Complete [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md).
7. Enable `PROVIDER_LIVE_CALLS_ENABLED` in target environment.

## Anti-Patterns

| Do Not | Do Instead |
|--------|-----------|
| Call provider APIs from business modules | Route through service → adapter |
| Return credentials in API responses | Return fingerprints via `toSafeCredential()` |
| Store tokens in `configuration` JSON | Use `providerCredentialService.storeCredential()` |
| Skip `assertProviderLiveCallsEnabled()` | Gate all external calls behind feature flag |
| Log request/response bodies | Log correlation ID and status only |
| Hardcode provider URLs | Use definition `apiVersion` and env-based base URLs |
| Ignore idempotency keys | Forward to provider on push operations |

## Example: Minimal OAuth Adapter Skeleton

```typescript
export class GoogleAnalyticsAdapter implements OAuthProviderAdapter {
  readonly providerKey = "google-analytics" as const;

  async createAuthorizationUrl({ redirectUri, state, scopes }) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", getServerEnv().GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", scopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    return { url: url.toString() };
  }

  async exchangeAuthorizationCode({ code, redirectUri }) {
    assertProviderLiveCallsEnabled();
    // POST to https://oauth2.googleapis.com/token
    // Return tokens + externalAccountId
  }

  // ... refreshAccessToken, revokeConnection, testConnection, getHealth
}
```

## Related Documentation

- [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md)
- [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md)
- [PROVIDER_WEBHOOK_STANDARD.md](./PROVIDER_WEBHOOK_STANDARD.md)
- [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md)
