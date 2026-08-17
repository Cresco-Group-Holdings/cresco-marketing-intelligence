# Connection Lifecycle

This document describes the end-to-end lifecycle for OAuth `ProviderConnection` records.

## States

Connections progress through the existing `ProviderConnection.status` enum, including:

| Status | Meaning |
|--------|---------|
| `DRAFT` / `PENDING` | Connection created, OAuth not started |
| `PENDING_AUTHORIZATION` | Authorization URL issued, awaiting callback |
| `CONNECTED` | OAuth complete, credentials stored, provider validated |
| `ACTION_REQUIRED` | Connected but missing required scopes |
| `REAUTH_REQUIRED` / `EXPIRED` | Token expired or refresh unavailable |
| `DEGRADED` | Health check failed; may still be usable |
| `REVOKED` / `ARCHIVED` | Disconnected; credentials invalidated |

## Connect

1. User clicks **Connect** on integrations UI (requires `integration.connect` permission).
2. API creates or reuses a connection in `PENDING_AUTHORIZATION`.
3. OAuth transaction persisted with encrypted state and optional PKCE verifier.
4. User redirected to provider authorization screen.
5. Provider redirects to Cresco callback with `code` and `state`.

## Callback

1. Validate OAuth transaction (digest, expiry, provider match, not consumed).
2. Verify signed state payload matches transaction organisation/connection/provider.
3. Exchange authorization code via `ProviderOAuthAdapter`.
4. Validate connection health with provider before activation.
5. Store encrypted access (and refresh) tokens in `credentialVault`.
6. Discover provider accounts (pages, Instagram business, ad accounts).
7. Transition to `CONNECTED` or `ACTION_REQUIRED` if scopes are missing.
8. Redirect user to integrations UI with success or error category.

## Token refresh

`tokenLifecycleService.getValidAccessToken()`:

1. Load connection and verify tenant ownership.
2. Read encrypted access token from vault.
3. If token is valid beyond refresh buffer, return immediately.
4. Otherwise acquire advisory lock and refresh via adapter.
5. Persist new encrypted credentials and update `tokenExpiresAt`, `lastSuccessfulAt`.
6. On failure, set `REAUTH_REQUIRED` or `REFRESH_FAILED` as appropriate.

## Health verification

`integrationsConnectionService.verify()` calls `ProviderOAuthAdapter.validateConnection()` with a server-side access token. Results update:

- `lastHealthCheckAt`
- `lastSuccessfulAt` (on success)
- `lastErrorCode` / `lastErrorMessage` (on failure)

Health checks are on-demand (verify button / API), not on every page render.

## Reconnect

Reconnect reuses the existing connection ID, transitions to `PENDING_AUTHORIZATION`, and starts a new OAuth transaction. Use when tokens are expired or scopes changed.

## Disconnect / revoke

**Revoke** (UI "Revoke" button):

1. Attempt remote token revocation via adapter (Meta: `DELETE /me/permissions`).
2. Revoke all local credentials via `credentialVault.revokeAll()`.
3. Transition connection to `REVOKED`.
4. Record audit event (`CREDENTIAL_REVOKED`).

**Disconnect** (without remote revoke):

Same as revoke but skips remote API call; records `CONNECTION_DISCONNECTED`.

## Audit events

Safe audit actions include:

- `AUTHORIZATION_STARTED`
- `AUTHORIZATION_COMPLETED`
- `CREDENTIAL_REFRESHED` (success/failure)
- `CREDENTIAL_REVOKED`
- `CONNECTION_DISCONNECTED`

Never logged: access tokens, refresh tokens, authorization codes, client secrets.

## Worker maintenance (Task 2)

Background workers should call:

```typescript
await tokenLifecycleService.refreshExpiringConnections({
  withinMs: 5 * 60 * 1000,
  limit: 50,
});
```

This entry point is idempotent and safe for serverless/scheduled execution.

## Tenant isolation

All connection operations filter by `organisationId` from authenticated tenant context. OAuth callbacks bind organisation from the signed transaction — never from unauthenticated query parameters alone.

## RBAC

Integration permissions:

- `integration.read` — list connections
- `integration.connect` — start OAuth
- `integration.manage` — reconnect, verify, account selection
- `integration.admin` — revoke/disconnect, credential rotation

Read-only roles must not manage credentials.
