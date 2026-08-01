# Provider Security Model

Security requirements for the Task 7.1 provider integration foundation. All mechanisms below are implemented; live API enforcement gates on `PROVIDER_LIVE_CALLS_ENABLED` (Task 7.2+).

## Principles

1. **No plaintext secrets at rest** — credentials are AES-256-GCM encrypted before database write.
2. **No plaintext secrets in transit to clients** — APIs return fingerprints only.
3. **No secrets in logs or audit metadata** — automatic redaction before persistence.
4. **Tenant isolation** — every query scoped by `organisationId`.
5. **Least privilege** — granular permissions per provider operation.
6. **Defense in depth** — OAuth state signing, webhook HMAC, return URL allowlist, replay prevention.

## Encryption

### At-Rest Encryption

Implementation: `src/lib/security/encryption.ts`

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key derivation | scrypt (`cresco-connector-v{version}` salt) |
| Key source | `ENCRYPTION_KEY` env var (min 32 chars, mandatory) |
| IV | 12 random bytes per encryption |
| Storage format | `v{version}:{iv}:{authTag}:{ciphertext}` (base64url) |
| Current version | `1` (`getCurrentEncryptionKeyVersion()`) |

`providerCredentialService.storeCredential()` encrypts via `encryptSecret()` before writing to `ProviderCredential.encryptedValue`. Plaintext exists only in server memory during the store/retrieve operation and is never returned by API handlers.

### Key Rotation

`rotateEncryptedSecret(payload)` decrypts with the embedded version and re-encrypts with the current version. Rotation workflow:

1. Deploy new `ENCRYPTION_KEY` (or `PROVIDER_ENCRYPTION_KEY` when wired).
2. Run batch re-encryption of `ProviderCredential` rows.
3. Update `keyVersion` on each row.

`PROVIDER_ENCRYPTION_KEY` and `PROVIDER_ENCRYPTION_KEY_VERSION` are defined in the environment schema for future dedicated provider key material. Currently, `ENCRYPTION_KEY` is used for all credential encryption.

### OAuth State Signing

`OAUTH_STATE_SIGNING_KEY` (falls back to `ENCRYPTION_KEY`) signs OAuth state payloads via HMAC-SHA256. See [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md).

## Credential Governance

### Storage Rules

| Rule | Enforcement |
|------|-------------|
| Credentials only in `ProviderCredential` table | `providerCredentialService` |
| One credential per `(connectionId, credentialType)` | Prisma `@@unique` constraint |
| Revocation is soft-delete (`revokedAt`) | `revokeCredential()`, `revokeAllCredentials()` |
| Configuration JSON on connections is non-secret | Property IDs, account IDs only — never tokens |

### Credential Types

```
OAUTH_ACCESS_TOKEN, OAUTH_REFRESH_TOKEN, API_KEY, CLIENT_SECRET,
WEBHOOK_SIGNING_SECRET, SMTP_PASSWORD, SERVICE_ACCOUNT_KEY,
BEARER_TOKEN, BASIC_AUTH
```

### Display Policy

Only fingerprints are exposed to users and APIs:

```typescript
fingerprintCredential("abcdefghijklmnop") // → "****mnop"
```

Short values (≤4 chars) display as `****`.

### Retrieval Policy

`getCredentialPlaintext()` is server-only. It:

1. Queries `ProviderCredential` where `revokedAt IS NULL`.
2. Decrypts in memory.
3. Returns plaintext to the calling service (never to HTTP responses).

Business modules must not import `getCredentialPlaintext()` directly — access flows through provider services and adapters.

## Secret Redaction

Implementation: `src/lib/providers/credential-redaction.ts`

### Redacted Keys

Objects with these keys are replaced with `[REDACTED]` before audit persistence:

```
access_token, refresh_token, api_key, apiKey, client_secret, clientSecret,
password, secret, token, authorization, private_key, privateKey,
webhook_secret, webhookSecret, encryptedValue, credentialsRef
```

### Pattern Redaction

Regex patterns catch inline secrets in strings:

- Stripe-style keys: `sk_*`, `pk_*`
- Bearer tokens: `Bearer <token>`

`providerAuditService.recordEvent()` applies `redactSecrets()` to all metadata. `sanitizeErrorMessage()` redacts secrets from error messages in `normalizeProviderError()`.

## Audit Trail

Every security-relevant action is logged to `ProviderAuditEvent`:

| Action | Trigger |
|--------|---------|
| `CONNECTION_CREATED` | Draft connection created |
| `AUTHORIZATION_STARTED` | OAuth flow initiated |
| `AUTHORIZATION_COMPLETED` | Token exchange succeeded (7.2+) |
| `AUTHORIZATION_FAILED` | OAuth error (7.2+) |
| `CREDENTIAL_REFRESHED` | Token refresh (7.2+) |
| `CREDENTIAL_REVOKED` | Disconnect or explicit revocation |
| `CONNECTION_TESTED` | Health check (7.2+) |
| `WEBHOOK_RECEIVED` | Verified webhook accepted |
| `WEBHOOK_REJECTED` | Signature/timestamp/validation failure |
| `SYNC_STARTED` / `SYNC_COMPLETED` / `SYNC_FAILED` | Sync runs (7.2+) |
| `RATE_LIMIT_REACHED` | Rate limit hit (7.2+) |

Audit records include: `organisationId`, `providerKey`, `connectionId`, `actorUserId`, `requestId`, `result`, `errorCode`, redacted `metadata`.

## Tenant Isolation

### Database Level

Every provider model includes `organisationId`. Services enforce scope:

```typescript
assertOrganisationScope(context);
// All queries: where: { organisationId: context.organisationId }
```

Connection lookups use composite filters: `{ id: connectionId, organisationId: context.organisationId }`.

### API Level

- `requireOrganisationId(request)` — rejects requests without tenant context.
- `withProviderConnectionsRead/Write/Authorize` — permission checks via `withApiHandler`.
- Webhook tenant resolution maps `externalAccountId` from payload to a `ProviderConnection` — never trusts client-supplied `organisationId`.

### Permissions

```
providerConnections.read
providerConnections.create
providerConnections.update
providerConnections.delete
providerConnections.authorize
providerConnections.revoke
providerConnections.test
providerConnections.viewAudit
providerConnections.manageWebhooks
providerConnections.manageCredentials
```

## Webhook Security

| Control | Implementation |
|---------|---------------|
| HMAC signature verification | `verifyHmacWebhookSignature()` — timing-safe compare |
| Timestamp tolerance | 5-minute window (`PROVIDER_WEBHOOK_TIMESTAMP_TOLERANCE_MS`) |
| Signature required | Rejects unsigned webhooks with `SIGNATURE_REQUIRED` |
| Idempotency | `@@unique([providerKey, externalEventId])` |
| Payload digest only | Stores SHA-256 hash, not raw body |

See [PROVIDER_WEBHOOK_STANDARD.md](./PROVIDER_WEBHOOK_STANDARD.md).

## OAuth Security

| Control | Implementation |
|---------|---------------|
| State signing | HMAC-SHA256 signed payload with expiry |
| PKCE | Required for `OAUTH2_PKCE` auth type providers |
| State consumption | Single-use (`consumedAt` prevents replay) |
| State TTL | 10 minutes |
| Return URL allowlist | Relative paths only; prefixes: `/integrations`, `/settings`, `/connectors` |
| No absolute URLs | `https://` return URLs rejected |

See [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md).

## Feature Flag Safety

| Flag | Safe Default | Risk if Misconfigured |
|------|-------------|----------------------|
| `PROVIDER_CONNECTORS_ENABLED` | `true` | Set `"false"` to disable all connector operations |
| `PROVIDER_LIVE_CALLS_ENABLED` | `false` | Must be explicitly `"true"` to allow external API calls |

Task 7.1 never makes live calls regardless of flags. Task 7.2+ adapters must call `assertProviderLiveCallsEnabled()` before external requests.

## Environment Isolation

| Requirement | Detail |
|-------------|--------|
| Separate `ENCRYPTION_KEY` per environment | Dev, Preview, Production must not share keys |
| Separate OAuth apps per environment | Different client IDs/secrets per Vercel environment |
| Separate databases | Preview/Production use isolated Postgres instances |
| No production credentials in Preview/Dev | Enforced by separate Vercel env var scopes |

See [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md).

## Threat Model Summary

| Threat | Mitigation |
|--------|-----------|
| Credential leak via API response | Fingerprints only; `SafeProviderConnection` type |
| Credential leak via logs | `redactSecrets()` on audit metadata and error messages |
| Cross-tenant data access | `organisationId` on every query; webhook resolves by `externalAccountId` |
| OAuth CSRF / state tampering | Signed state payload + single-use consumption |
| OAuth redirect hijacking | Return URL allowlist (relative paths only) |
| Webhook replay | Timestamp tolerance + idempotent event ID |
| Webhook forgery | HMAC signature verification (timing-safe) |
| Unauthorized connector management | RBAC permissions on all API routes |

## Related Documentation

- [PROVIDER_CREDENTIAL_LIFECYCLE.md](./PROVIDER_CREDENTIAL_LIFECYCLE.md)
- [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md)
