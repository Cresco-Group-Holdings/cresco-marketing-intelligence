# OAuth Security

Connector OAuth flows reuse a shared lifecycle service and never expose secrets to clients.

## Lifecycle

Implemented in `src/server/services/connector-oauth-service.ts`:

1. **Begin connection** — generate secure state, optional PKCE verifier/challenge, persist `ConnectorOAuthState`, return authorisation URL metadata.
2. **Callback handling** — validate state expiry, exchange authorisation code through the provider adapter, inspect granted scopes.
3. **Token storage** — encrypt access and refresh tokens separately via `connector-credential-service`.
4. **Refresh** — adapter-driven refresh using stored refresh token.
5. **Revocation** — adapter revocation plus credential deletion on disconnect.
6. **Reconnect** — refresh tokens and reset account error state.

## Controls

- OAuth state expires after 10 minutes.
- PKCE is supported for providers that require it.
- Scope inspection enforces least-privilege required scopes before marking an account `CONNECTED`.
- Provider API keys and client secrets remain server-side via `getServerEnv()`.
- Credentials are encrypted at rest with AES-256-GCM (`src/lib/security/encryption.ts`).
- Encryption supports key rotation without exposing plaintext tokens.
- APIs return only public account metadata; tokens are never included in responses.
- Credentials are never written to logs or audit metadata.
- Disconnect explicitly deletes encrypted credential rows.

## Future provider wiring

Real provider adapters will plug into `ConnectorAdapter` without changing route handlers or UI. Until a provider adapter is registered and marked `AVAILABLE`, the connect action remains disabled.
