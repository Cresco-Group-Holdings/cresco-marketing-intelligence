# Provider Integration Architecture

Task 7.1 establishes the **foundation layer** for external provider integrations. It defines domain models, services, adapter contracts, and security primitives. **No live API calls are made in Task 7.1** — all external providers are registered but disabled (`enabled: false`), and `resolveProviderAdapter()` returns `null` until Task 7.2+.

## Scope

| In scope (7.1) | Out of scope (7.2+) |
|----------------|---------------------|
| Provider registry and definitions | Live adapter implementations |
| Connection/credential persistence | Real OAuth token exchange |
| OAuth state signing and PKCE helpers | Provider API request execution |
| Webhook verification primitives | Sync job orchestration |
| Audit logging and tenant isolation | Circuit breaker runtime enforcement |
| Feature flags (`PROVIDER_CONNECTORS_ENABLED`, `PROVIDER_LIVE_CALLS_ENABLED`) | Enabling disabled providers |

## Request Flow

Business modules must not call external APIs directly. All provider access flows through the service layer and (when implemented) adapters.

```
┌─────────────────────┐
│  Business Module    │  e.g. social publishing, ads management, email send
│  (feature code)     │
└──────────┬──────────┘
           │ uses TenantContext + connectionId
           ▼
┌─────────────────────┐
│  Provider Service   │  src/server/services/provider-*-service.ts
│  (orchestration)    │  Enforces tenancy, audit, feature flags
└──────────┬──────────┘
           │ resolves adapter (7.2+)
           ▼
┌─────────────────────┐
│  Adapter Interface  │  src/lib/providers/adapter-contracts.ts
│  (capability-based) │  OAuthProviderAdapter, WebhookProviderAdapter, etc.
└──────────┬──────────┘
           │ implements provider-specific logic
           ▼
┌─────────────────────┐
│  Adapter            │  Task 7.2+ per provider
│  (provider impl)    │
└──────────┬──────────┘
           │ HTTPS
           ▼
┌─────────────────────┐
│  External API       │  Meta, Google, Stripe, etc.
└─────────────────────┘
```

### Service Layer

| Service | File | Responsibility |
|---------|------|----------------|
| Connection | `provider-connection-service.ts` | CRUD for `ProviderConnection`, status transitions, disconnect |
| Credential | `provider-credential-service.ts` | Encrypt/store/revoke credentials; never expose plaintext to callers |
| OAuth | `provider-oauth-service.ts` | Start authorization, consume OAuth state (stub authorize URL in 7.1) |
| Webhook | `provider-webhook-service.ts` | Ingest, verify, deduplicate, resolve tenant from payload |
| Audit | `provider-audit-service.ts` | Append-only audit trail with secret redaction |

### API Routes (7.1)

| Route | Method | Permission |
|-------|--------|------------|
| `/api/providers/definitions` | GET | `providerConnections.read` |
| `/api/providers/connections` | GET, POST | read / create |
| `/api/providers/connections/[id]` | GET, POST | read / authorize / disconnect |

All routes require `organisationId` (query param or `x-organisation-id` header) and enforce tenant scope via `withApiHandler`.

## Registry

The registry (`src/lib/providers/registry.ts`) is the single source of truth for provider metadata.

```typescript
// Key registry functions
getProviderDefinition(providerKey)
listProviderDefinitions()
listEnabledProviders()
supportsCapability(providerKey, capability)
validateProviderConfiguration(providerKey, configuration)
getRequiredOAuthScopes(providerKey, capability?)
resolveProviderAdapter(providerKey, capability?) // returns null in 7.1
```

Provider definitions live in `src/lib/providers/definitions.ts`. Each entry includes:

- `key`, `displayName`, `category`, `authType`
- `capabilities[]` — maps to `ProviderCapabilityType` enum
- `supportedEnvironments[]` — `SANDBOX`, `STAGING`, `PRODUCTION`
- `requiredConfigFields` / `optionalConfigFields`
- `webhookSupport`, `pushSupport`, `pullSupport`
- `enabled` — **false for all external providers in 7.1** (only `csv-import` and `first-party-crawler` are enabled)
- `requiresApproval` — gates production enablement

## Domain Models (Prisma)

### ProviderConnection

Central record linking a tenant to an external provider.

| Field | Purpose |
|-------|---------|
| `organisationId` | Tenant isolation (required) |
| `projectId`, `brandId`, `userId` | Optional ownership scope |
| `providerKey` | Registry key (e.g. `google-analytics`) |
| `status` | Lifecycle: `DRAFT` → `PENDING_AUTHORIZATION` → `CONNECTED` → … |
| `environment` | `SANDBOX`, `STAGING`, or `PRODUCTION` |
| `configuration` | Non-secret JSON config (property IDs, account IDs) |
| `grantedScopes` | OAuth scopes granted |
| `externalAccountId`, `externalLabel` | Provider-side identity |
| `tokenExpiresAt` | Access token expiry for refresh scheduling |

### ProviderCredential

Encrypted secrets, one row per `(connectionId, credentialType)`.

| Field | Purpose |
|-------|---------|
| `encryptedValue` | AES-256-GCM ciphertext (never plaintext) |
| `keyVersion` | Encryption key version for rotation |
| `fingerprint` | Last-4 display only (e.g. `****abcd`) |
| `revokedAt` | Soft revocation timestamp |

### Supporting Models

| Model | Purpose |
|-------|---------|
| `ProviderOAuthState` | Short-lived OAuth state with PKCE verifier, signed payload |
| `ProviderWebhookEndpoint` | Registered webhook URL and secret digest per connection |
| `ProviderWebhookEvent` | Idempotent event log (`@@unique([providerKey, externalEventId])`) |
| `ProviderSyncCursor` | Pagination cursor per resource type |
| `ProviderSyncRun` | Sync job execution record |
| `ProviderRateLimitState` | Per-connection rate limit window tracking |
| `ProviderHealthState` | Health check and circuit breaker state |
| `ProviderAuditEvent` | Immutable audit log |
| `ProviderFeatureFlag` | Per-org provider feature toggles |

## Connection Status Lifecycle

```
DRAFT
  └─► PENDING_AUTHORIZATION  (OAuth started)
        └─► CONNECTED          (credentials stored)
              ├─► DEGRADED     (intermittent failures)
              ├─► REAUTH_REQUIRED
              ├─► RATE_LIMITED
              ├─► ERROR
              └─► REVOKED / DISABLED
```

`SafeProviderConnection` (returned by services) never includes credentials or raw configuration secrets.

## Adapter Contracts

Defined in `src/lib/providers/adapter-contracts.ts`. Adapters are composed by capability:

| Interface | Capabilities |
|-----------|-------------|
| `ProviderAdapter` | Base: `validateConfiguration`, `testConnection`, `getHealth` |
| `OAuthProviderAdapter` | `createAuthorizationUrl`, `exchangeAuthorizationCode`, `refreshAccessToken`, `revokeConnection` |
| `ApiKeyProviderAdapter` | `validateApiKey` |
| `WebhookProviderAdapter` | `verifyWebhookSignature`, `extractEventId`, `normalizeWebhookEvent` |
| `PullProviderAdapter` | `pull` with cursor pagination |
| `PushProviderAdapter` | `push` with idempotency key |
| `AnalyticsProviderAdapter` | `pullMetrics` |
| `PublishingProviderAdapter` | `publishContent` |
| `AdvertisingProviderAdapter` | `getCampaigns` |
| `EmailProviderAdapter` | `sendEmail` |
| `PaymentProviderAdapter` | `syncTransactions` |
| `SearchProviderAdapter` | `fetchRankings` |

Type guards: `isOAuthProviderAdapter()`, `isWebhookProviderAdapter()`.

## Execution Policy

`src/lib/providers/execution-policy.ts` provides shared retry/timeout logic for adapters (7.2+):

- Request timeout: 30s (`PROVIDER_REQUEST_TIMEOUT_MS`)
- Max retries: 3 with exponential backoff + jitter
- Error classification: `retryable`, `non_retryable`, `rate_limited`
- Circuit breaker threshold: 5 consecutive failures

## Feature Flags

| Flag | Default | Effect |
|------|---------|--------|
| `PROVIDER_CONNECTORS_ENABLED` | `true` (unless `"false"`) | Gates connection CRUD and OAuth start |
| `PROVIDER_LIVE_CALLS_ENABLED` | `false` (must be `"true"`) | Gates actual external API calls (7.2+) |

Per-org overrides via `ProviderFeatureFlag` model (not yet wired to runtime in 7.1).

## File Map

```
src/lib/providers/
  adapter-contracts.ts    # Interface definitions
  constants.ts            # TTLs, retry limits, return URL prefixes
  credential-redaction.ts # Secret redaction and fingerprinting
  definitions.ts          # All provider metadata
  execution-policy.ts     # Retry, timeout, error normalization
  feature-flags.ts        # Platform-level toggles
  registry.ts             # Lookup and validation
  types.ts                # TypeScript types
  oauth/
    pkce.ts               # PKCE + state token generation
    security.ts           # Return URL allowlist, OAuth error mapping
    state-signing.ts      # HMAC-signed OAuth state payloads
  webhook/
    verification.ts       # HMAC signature + timestamp validation

src/server/services/
  provider-audit-service.ts
  provider-connection-service.ts
  provider-credential-service.ts
  provider-oauth-service.ts
  provider-webhook-service.ts
```

## Related Documentation

- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md)
- [PROVIDER_CREDENTIAL_LIFECYCLE.md](./PROVIDER_CREDENTIAL_LIFECYCLE.md)
- [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md)
- [PROVIDER_WEBHOOK_STANDARD.md](./PROVIDER_WEBHOOK_STANDARD.md)
- [PROVIDER_ADAPTER_GUIDE.md](./PROVIDER_ADAPTER_GUIDE.md)
- [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md)
