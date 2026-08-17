# OAuth Architecture

Cresco Marketing Intelligence uses a single canonical OAuth stack for provider connections. Business modules (publishing, analytics, social inbox, paid advertising) must consume active `ProviderConnection` records through the shared provider layer — they must not implement OAuth themselves.

## Canonical flow

```
Integrations UI
  → POST /api/integrations/oauth/[providerKey]/connect
  → oauthAuthorizationService.startConnect()
  → oauthAdapterRegistry (via resolveProviderOAuthAdapter)
  → ProviderOAuthAdapter.buildAuthorizationUrl()
  → External provider authorization screen
  → GET /api/integrations/oauth/[providerKey]/callback
  → oauthCallbackService.handleCallback()
  → ProviderOAuthAdapter.exchangeAuthorizationCode()
  → credentialVault.store() (encrypted at rest)
  → connectionLifecycleService.transition(CONNECTED)
  → providerAccountDiscoveryService.discoverAndStoreAccounts()
```

## Core components

| Layer | Responsibility |
|-------|----------------|
| `ProviderDefinition` | Registry metadata, capabilities, scopes |
| `ProviderOAuthAdapter` | Provider-specific OAuth (auth URL, exchange, refresh, revoke, identity) |
| `oauthAuthorizationService` | Start connect, create OAuth transaction, signed state |
| `oauthCallbackService` | Validate state, exchange code, activate connection |
| `tokenLifecycleService` | `getValidAccessToken`, refresh with advisory lock, worker entry point |
| `credentialVault` | Encrypted credential storage (Stage 12) |
| `ProviderConnection` | Tenant-scoped connection record and health metadata |

## Production providers

Production OAuth is enabled for:

- `meta` — Facebook Pages and Instagram Business
- `meta-ads` — Meta advertising accounts

All other OAuth providers remain disabled or mock-only until explicitly productionized.

## Mock policy

Mocks are permitted only when:

- `NODE_ENV=test`, or
- `ALLOW_OAUTH_MOCK=true` (local development)

In production, missing credentials for a production provider throw `AUTH_CONFIGURATION_ERROR`. The application never silently falls back to `mock-social-adapter` or mock OAuth tokens.

Social publishing mock adapters require `ALLOW_MOCK_SOCIAL_ADAPTERS=true` in non-test environments.

## OAuth state security

OAuth state binds:

- organisation/workspace
- authenticated user (in encrypted transaction payload)
- provider key
- connection ID
- return path
- nonce (state token)
- expiry (transaction TTL)

State is signed (`OAUTH_STATE_SIGNING_KEY`) and stored encrypted. Callback handlers verify digest lookup, signed payload, provider match, and transaction expiry before exchanging codes.

## Legacy paths (deprecated)

Do not add new callers to:

- `/api/connectors/oauth/*` (legacy connector OAuth)
- `social-oauth-service.ts` / `social-connection-service.ts` mock path for production connections

Use Stage 12 `/api/integrations/oauth/*` exclusively for new work.

## Token lifecycle

Server-side code that needs provider access should call:

```typescript
tokenLifecycleService.getValidAccessToken({ organisationId, actorUserId }, connectionId)
```

Background workers should call:

```typescript
tokenLifecycleService.refreshExpiringConnections({ withinMs, limit })
```

Refresh uses PostgreSQL advisory transaction locks per connection to prevent concurrent refresh races.

## Disconnect vs revoke

| Action | Behavior |
|--------|----------|
| **Disconnect** | Stop local credential use; optionally skip remote revoke |
| **Revoke** | Attempt remote provider revocation, then always clear local credentials and mark `REVOKED` |

Remote revoke failure does not leave local tokens usable.

## Environment validation

`getProviderOAuthConfigDetail(providerKey)` returns:

- `READY` — credentials present, real adapter used
- `MISCONFIGURED` — production provider missing required env vars
- `DISABLED` — not a production OAuth provider

The integrations UI reflects this state and disables connect for misconfigured providers.

## Related documentation

- [Connection Lifecycle](./CONNECTION_LIFECYCLE.md)
- [Meta Setup](./META_SETUP.md)
