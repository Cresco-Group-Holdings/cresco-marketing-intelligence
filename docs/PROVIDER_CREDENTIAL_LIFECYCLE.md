# Provider Credential Lifecycle

End-to-end lifecycle for provider credentials in the Task 7.1 foundation. Credentials are always encrypted at rest and exposed to users as fingerprints only.

## Overview

```
Create ──► Store (encrypted) ──► Use (server-only decrypt) ──► Refresh ──► Rotate ──► Revoke
                                                                              │
                                                                    Display: fingerprint only
```

## 1. Create

Credentials enter the system through one of three paths (full exchange in Task 7.2+):

| Path | Auth Type | Entry Point |
|------|-----------|-------------|
| OAuth token exchange | `OAUTH2_*` | `providerOAuthService` → adapter `exchangeAuthorizationCode()` |
| API key submission | `API_KEY`, `BEARER_TOKEN`, etc. | Connection setup form → `providerCredentialService.storeCredential()` |
| Webhook registration | `WEBHOOK_SIGNING_SECRET` | Webhook endpoint setup → `storeCredential()` |

In Task 7.1, OAuth exchange is stubbed. Draft connections can be created; credential storage primitives are ready but not triggered by live flows.

### Draft Connection (No Credentials Yet)

```
POST /api/providers/connections
{
  "providerKey": "google-analytics",
  "configuration": { "propertyId": "123456789" }
}
```

Creates a `ProviderConnection` with `status: DRAFT`. Configuration holds non-secret fields only (property IDs, account IDs). No `ProviderCredential` rows exist yet.

## 2. Store (Encrypted)

Implementation: `providerCredentialService.storeCredential()`

```typescript
await providerCredentialService.storeCredential({
  organisationId: context.organisationId,
  connectionId: connection.id,
  credentialType: "OAUTH_ACCESS_TOKEN",
  plaintext: accessToken,        // exists in memory only during this call
  expiresAt: tokenExpiry,        // optional
});
```

### What Happens

1. `encryptSecret(plaintext)` → AES-256-GCM ciphertext.
2. `fingerprintCredential(plaintext)` → `****{last4}` for display.
3. `getCurrentEncryptionKeyVersion()` → stored as `keyVersion`.
4. Upsert on `(connectionId, credentialType)` — replaces existing credential of same type.

### Database Record

| Field | Example | Notes |
|-------|---------|-------|
| `encryptedValue` | `v1:iv:tag:ciphertext` | Never plaintext |
| `keyVersion` | `1` | For rotation tracking |
| `fingerprint` | `****x7Kp` | Safe for UI display |
| `expiresAt` | `2026-08-01T00:00:00Z` | Token expiry (OAuth) |
| `revokedAt` | `null` | Set on revocation |

### Credential Types

| Type | Used For |
|------|----------|
| `OAUTH_ACCESS_TOKEN` | Short-lived OAuth access token |
| `OAUTH_REFRESH_TOKEN` | Long-lived OAuth refresh token |
| `API_KEY` | Provider API keys (Resend, Stripe, etc.) |
| `CLIENT_SECRET` | OAuth client secret (if per-tenant) |
| `WEBHOOK_SIGNING_SECRET` | Webhook HMAC verification |
| `SMTP_PASSWORD` | SMTP authentication |
| `SERVICE_ACCOUNT_KEY` | Google service account JSON |
| `BEARER_TOKEN` | Static bearer tokens |
| `BASIC_AUTH` | Username/password pairs |

## 3. Use (Server-Only)

```typescript
const token = await providerCredentialService.getCredentialPlaintext(
  connectionId,
  "OAUTH_ACCESS_TOKEN",
);
```

Rules:

- **Server-only** — never called from API route handlers that return to clients.
- **Revoked credentials excluded** — `revokedAt IS NULL` filter.
- **Returns `null`** if no active credential exists.
- Plaintext exists in memory only for the duration of the adapter operation.

Adapters (7.2+) retrieve credentials via service layer, attach to HTTP requests, and discard from scope after use.

## 4. Refresh

Token refresh is an adapter responsibility (7.2+), orchestrated by the service layer:

```
1. Detect expiry (tokenExpiresAt on connection, or 401 from provider)
2. Retrieve OAUTH_REFRESH_TOKEN via getCredentialPlaintext()
3. Call adapter.refreshAccessToken()
4. Store new OAUTH_ACCESS_TOKEN (and optionally new refresh token)
5. Update connection.tokenExpiresAt
6. Audit: CREDENTIAL_REFRESHED
```

In Task 7.1, refresh logic is not wired. The `OAuthProviderAdapter.refreshAccessToken()` contract is defined in `adapter-contracts.ts`.

### Proactive Refresh

Connections with `tokenExpiresAt` approaching expiry should be refreshed before API calls fail. Scheduling is a 7.2+ concern (background job or pre-request check).

## 5. Rotate

### Encryption Key Rotation

When `ENCRYPTION_KEY` changes:

```typescript
import { rotateEncryptedSecret } from "@/lib/security/encryption";

const newCiphertext = rotateEncryptedSecret(credential.encryptedValue);
// Update row: encryptedValue = newCiphertext, keyVersion = current
```

Run as a batch migration across all `ProviderCredential` rows. No plaintext exposure to users or logs.

### Credential Rotation (Provider-Side)

When a provider issues a new API key or refresh token:

1. Store new credential via `storeCredential()` (upsert replaces old).
2. Optionally revoke old credential explicitly.
3. Audit: `CREDENTIAL_REFRESHED` or `CREDENTIAL_REVOKED` + new store.

### Webhook Secret Rotation

1. Generate new secret with provider.
2. Store as new `WEBHOOK_SIGNING_SECRET` credential.
3. Update `ProviderWebhookEndpoint.secretDigest`.
4. Grace period: accept both old and new signatures during transition (7.2+).

## 6. Revoke

### Single Credential

```typescript
await providerCredentialService.revokeCredential(connectionId, "OAUTH_ACCESS_TOKEN");
```

Sets `revokedAt` timestamp. Credential is no longer returned by `getCredentialPlaintext()`.

### All Credentials (Disconnect)

```typescript
await providerCredentialService.revokeAllCredentials(connectionId);
```

Called during `disconnectConnection()`:

1. Sets connection `status: REVOKED`, `revokedAt`, `disconnectedAt`.
2. Revokes all active credentials.
3. Audit: `CREDENTIAL_REVOKED`.

### Provider-Side Revocation (7.2+)

Adapters implementing `OAuthProviderAdapter.revokeConnection()` should call the provider's token revocation endpoint before local revocation.

## 7. Display (Fingerprint Only)

### Safe Credential Response

```typescript
providerCredentialService.toSafeCredential(credential)
// Returns: { id, credentialType, fingerprint, expiresAt, revokedAt, createdAt }
// Never: encryptedValue, plaintext
```

### Fingerprint Format

```typescript
fingerprintCredential("sk_live_abcdefghijklmnop") // → "****mnop"
fingerprintCredential("abc")                        // → "****"
```

### Connection Display

`SafeProviderConnection` (returned by connection APIs) includes:

- `externalLabel` — provider account name/email
- `tokenExpiresAt` — when re-auth may be needed
- `reauthorizationRequired` — derived from `status === "REAUTH_REQUIRED"`
- **Never** includes tokens, keys, or encrypted values

## Lifecycle by Auth Type

| Auth Type | Create | Refresh | Revoke |
|-----------|--------|---------|--------|
| `OAUTH2_PKCE` | OAuth exchange → access + refresh tokens | `refreshAccessToken()` | Disconnect + provider revoke |
| `OAUTH2_AUTHORIZATION_CODE` | Same | Same | Same |
| `API_KEY` | User submits key → store | Manual re-entry | Revoke + delete |
| `SMTP_CREDENTIALS` | User submits host/user/pass | Manual re-entry | Revoke |
| `AWS_SIGNATURE` | Access key + secret | IAM rotation | Revoke |
| `INTERNAL` / `NONE` | No credentials | N/A | N/A |

## Audit Events

| Event | When |
|-------|------|
| `CONNECTION_CREATED` | Draft connection (no credentials yet) |
| `AUTHORIZATION_COMPLETED` | Credentials stored after OAuth (7.2+) |
| `CREDENTIAL_REFRESHED` | Token refresh succeeded (7.2+) |
| `CREDENTIAL_REVOKED` | Disconnect or explicit revocation |

All audit metadata passes through `redactSecrets()` — see [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md).

## Task 7.1 Status

| Step | Status |
|------|--------|
| Encrypt/store/revoke primitives | Implemented |
| Fingerprint display | Implemented |
| OAuth credential exchange | Stubbed (no live exchange) |
| Token refresh | Contract defined; not wired |
| Key rotation utility | `rotateEncryptedSecret()` available |
| Batch rotation job | Not implemented |

## Related Documentation

- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md)
- [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md)
