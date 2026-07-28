# Social OAuth Security

## Principles

1. **Server-only secrets** — Provider client secrets and tokens never reach the browser
2. **Encrypted at rest** — Access and refresh tokens encrypted separately with AES-256-GCM
3. **State binding** — OAuth state tied to user, organisation, project, and brand
4. **Short-lived state** — 10-minute TTL; consumed on use (replay prevention)
5. **PKCE** — Used where supported for all providers in registry
6. **No tokens in URLs** — Callback redirects use `connectionId` only, never tokens or codes

## OAuth State

`OAuthAuthorisationState` stores:

- `state` (unique, cryptographically random)
- `userId`, `organisationId`, `projectId`, `brandId`
- `codeVerifier` (PKCE)
- `redirectUri` (validated on callback)
- `expiresAt`, `consumedAt`

Validation checks:

- State exists and not expired
- State not previously consumed (replay protection)
- `userId` matches authenticated user (cross-user prevention)
- `redirectUri` matches server-configured callback origin

## Token Storage

| Field | Storage |
|-------|---------|
| Access token | `SocialConnectionCredential.encryptedAccessToken` |
| Refresh token | `SocialConnectionCredential.encryptedRefreshToken` |
| Key version | `encryptionKeyVersion` for rotation support |

Tokens are decrypted only in server services during provider API calls.

## Disconnect

On disconnect:

1. Provider revoke called (best effort)
2. Credential row deleted
3. Assigned accounts deleted
4. Connection status set to `DISCONNECTED`

## Audit Trail

Audit events never include:

- Access tokens
- Refresh tokens
- Authorization codes
- PKCE verifiers

## Callback Security

- Callback requires authenticated session
- Provider validated against stored state
- Failed callbacks redirect to `/social/connections?error=...` without sensitive data
- Cross-tenant callback blocked by state validation against brand/org scope

## Encryption Key Rotation

`socialCredentialService.rotateStoredCredentials()` re-encrypts tokens and records `CredentialRotationEvent`.

## Logging

Structured logs use safe error messages via `toSafeErrorMessage()`. Credentials are never logged.
