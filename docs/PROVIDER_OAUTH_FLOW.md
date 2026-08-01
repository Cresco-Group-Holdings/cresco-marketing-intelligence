# Provider OAuth Flow

OAuth authorization flow for the Task 7.1 provider integration foundation. Task 7.1 implements state management, PKCE, signing, and replay prevention. **Token exchange is stubbed** — the authorize URL points to an internal stub endpoint, not a live provider.

## Flow Overview

```
User                App (API)              Database           Provider (7.2+)
 │                     │                      │                    │
 │── authorize ───────►│                      │                    │
 │                     │── create OAuthState ─►│                    │
 │                     │── sign state payload   │                    │
 │                     │◄─ authorizeUrl ────────│                    │
 │◄─ redirect ─────────│                      │                    │
 │─────────────────────────────────────────────────────────────────►│
 │                     │                      │                    │
 │◄────────────────────────────────────────────────────────────────│
 │── callback (code) ─►│                      │                    │
 │                     │── consume state ─────►│                    │
 │                     │── verify signature     │                    │
 │                     │── exchange code ──────────────────────────►│
 │                     │◄─ tokens ─────────────────────────────────│
 │                     │── store credentials ─►│                    │
 │◄─ redirect to app ──│                      │                    │
```

## Starting Authorization

### API

```
POST /api/providers/connections/{connectionId}
{
  "action": "authorize",
  "returnUrl": "/integrations"
}
```

Permission: `providerConnections.authorize`

### Service: `providerOAuthService.startAuthorization()`

1. **Validate return URL** — `isReturnUrlAllowed(returnUrl)`.
2. **Load connection** — scoped to `organisationId`.
3. **Check provider definition** — auth type determines PKCE usage.
4. **Generate state** — `generateOAuthStateToken()` (32 random bytes, base64url).
5. **Generate PKCE** — if `authType === "OAUTH2_PKCE"`: verifier + challenge.
6. **Sign payload** — `createSignedOAuthStatePayload()`.
7. **Persist state** — `ProviderOAuthState` row with 10-minute TTL.
8. **Update connection** — `status: PENDING_AUTHORIZATION`.
9. **Audit** — `AUTHORIZATION_STARTED`.
10. **Return authorize URL** — stub in 7.1; real provider URL in 7.2+.

### Redirect URI Resolution

```typescript
const redirectUri = env.OAUTH_CALLBACK_BASE_URL
  ?? `${env.APP_URL}/api/providers/oauth/callback`;
```

Register this URL in each provider's OAuth app console per environment. See [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md).

## State Signing

Implementation: `src/lib/providers/oauth/state-signing.ts`

### Signed Payload Structure

```typescript
{
  organisationId: string;
  providerKey: string;
  connectionId?: string;
  returnUrl?: string;
  nonce: string;
  issuedAt: number;    // epoch ms
  expiresAt: number;   // issuedAt + 10 minutes
}
```

### Signing Process

1. Serialize payload to JSON → base64url encode (body).
2. HMAC-SHA256(body, signingKey) → base64url encode (signature).
3. Combined format: `{body}.{signature}`.

### Signing Key

```typescript
OAUTH_STATE_SIGNING_KEY ?? ENCRYPTION_KEY
```

Use a dedicated `OAUTH_STATE_SIGNING_KEY` in production (recommended).

### Verification

`verifySignedOAuthStatePayload(signed)`:

1. Split body and signature.
2. Recompute HMAC — timing-safe compare.
3. Deserialize payload.
4. Reject if `expiresAt < Date.now()`.

## PKCE

Implementation: `src/lib/providers/oauth/pkce.ts` (re-exports from `src/lib/connectors/oauth/utils`)

### When Required

Providers with `authType: "OAUTH2_PKCE"`:

- meta, instagram, facebook, tiktok, x, meta-ads

### Flow

1. **Authorization request**: send `code_challenge` (S256 hash of verifier).
2. **Store verifier**: `ProviderOAuthState.codeVerifier`.
3. **Token exchange** (7.2+): send `code_verifier` with authorization code.

```typescript
const codeVerifier = generatePkceVerifier();       // stored in DB
const codeChallenge = generatePkceChallenge(codeVerifier); // sent to provider
```

Providers with `authType: "OAUTH2_AUTHORIZATION_CODE"` (LinkedIn, YouTube, Google, etc.) do not use PKCE in the current registry.

## Callback Handling

### Task 7.1 Status

The callback route (`/api/providers/oauth/callback`) is not yet implemented. The foundation provides:

- `consumeOAuthState(state)` — validates and marks state as consumed.
- `verifySignedOAuthStatePayload(signed)` — validates HMAC signature.

### Task 7.2+ Callback Steps

1. Extract `code` and `state` from query parameters.
2. Call `consumeOAuthState(state)`:
   - Reject if not found → `INVALID_OAUTH_STATE`.
   - Reject if `consumedAt` set → `OAUTH_STATE_REPLAY`.
   - Reject if expired → `OAUTH_STATE_EXPIRED` (row deleted).
   - Mark `consumedAt = now()`.
3. Verify `signedPayload` matches request context.
4. Resolve adapter via `resolveProviderAdapter()`.
5. Call `adapter.exchangeAuthorizationCode({ code, redirectUri, codeVerifier })`.
6. Store credentials via `providerCredentialService.storeCredential()`.
7. Update connection: `status: CONNECTED`, `externalAccountId`, `grantedScopes`, `tokenExpiresAt`.
8. Audit: `AUTHORIZATION_COMPLETED`.
9. Redirect to `returnUrl` (from signed payload).

### Error Handling

`mapOAuthError(error, description)` normalizes provider errors:

| Provider Error | Code |
|---------------|------|
| `access_denied` | `OAUTH_ACCESS_DENIED` |
| `invalid_grant` | `OAUTH_INVALID_GRANT` |
| other | `OAUTH_ERROR` |

Failed callbacks audit as `AUTHORIZATION_FAILED`.

## Replay Prevention

Multiple layers prevent OAuth state replay attacks:

| Layer | Mechanism |
|-------|-----------|
| **Single-use state** | `consumedAt` set on first consumption; subsequent attempts throw `OAUTH_STATE_REPLAY` |
| **TTL expiry** | 10-minute window (`PROVIDER_OAUTH_STATE_TTL_MS`); expired states deleted |
| **HMAC signature** | Tampered payloads fail verification |
| **Nonce** | Unique per authorization attempt |
| **Organisation binding** | Signed payload includes `organisationId` — cannot be transferred across tenants |

### State Record

```prisma
model ProviderOAuthState {
  state          String    @unique
  codeVerifier   String?
  nonce          String?
  signedPayload  String
  expiresAt      DateTime
  consumedAt     DateTime?  // null until consumed
}
```

## Return URL Allowlist

Implementation: `src/lib/providers/oauth/security.ts`

### Rules

1. **Omit or empty** — allowed (no post-auth redirect).
2. **Absolute URLs** (`http://`, `https://`) — **rejected**.
3. **Relative paths** — must start with `/` and match an allowed prefix.

### Allowed Prefixes

```typescript
PROVIDER_ALLOWED_RETURN_URL_PREFIXES = [
  "/integrations",
  "/settings",
  "/connectors",
]
```

### Examples

| URL | Allowed |
|-----|---------|
| `/integrations` | Yes |
| `/integrations/google-analytics` | Yes |
| `/settings/providers` | Yes |
| `https://evil.example/integrations` | No |
| `/admin/secret` | No |
| `//evil.example` | No |

## Scopes

Scopes are resolved from the provider definition:

```typescript
getRequiredOAuthScopes(providerKey, capability?)
// Returns definition.oauthScopes[capability] or definition.oauthScopes.default
```

Stored in `ProviderOAuthState.scopes` and persisted to `ProviderConnection.grantedScopes` after exchange.

## Task 7.1 Stub Behavior

In 7.1, `startAuthorization()` returns a stub authorize URL:

```
{redirectUri}/api/providers/{providerKey}/authorize-stub?state={state}&code_challenge={challenge}
```

This allows testing the full state creation, signing, and persistence flow without contacting external providers. The stub endpoint does not exist as a route — it documents the intended adapter integration point.

## Configuration Checklist

Before enabling OAuth for a provider (7.2+):

- [ ] Provider OAuth app created (separate per environment)
- [ ] `OAUTH_CALLBACK_BASE_URL` or `APP_URL` configured
- [ ] Redirect URI registered in provider console
- [ ] `OAUTH_STATE_SIGNING_KEY` set (production)
- [ ] Required scopes documented in provider definition
- [ ] Return URL prefixes cover all UI entry points
- [ ] `PROVIDER_LIVE_CALLS_ENABLED=true` only after adapter tested

## Related Documentation

- [PROVIDER_CREDENTIAL_LIFECYCLE.md](./PROVIDER_CREDENTIAL_LIFECYCLE.md)
- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md)
- [PROVIDER_ONBOARDING_CHECKLIST.md](./PROVIDER_ONBOARDING_CHECKLIST.md)
