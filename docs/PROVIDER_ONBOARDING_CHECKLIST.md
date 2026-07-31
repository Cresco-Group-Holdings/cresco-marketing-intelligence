# Provider Onboarding Checklist

Complete this checklist before enabling any provider (`enabled: true` in definitions) or setting `PROVIDER_LIVE_CALLS_ENABLED=true`. Task 7.1 ships with all external providers disabled — this checklist gates Task 7.2+ go-live.

## 1. Provider Definition

- [ ] Provider entry exists in `src/lib/providers/definitions.ts`
- [ ] `key` is unique and matches `ProviderKey` type in `types.ts`
- [ ] `category` matches `ProviderCategory` enum
- [ ] `authType` matches `ProviderAuthType` enum
- [ ] `capabilities[]` accurately reflect what the adapter implements
- [ ] `requiredConfigFields` and `optionalConfigFields` are correct
- [ ] `apiVersion` and `apiVersionStatus` are current
- [ ] `documentationUrl` points to provider API docs
- [ ] `oauthScopes` defined (if OAuth provider)
- [ ] `webhookSupport`, `pushSupport`, `pullSupport` flags are accurate

## 2. Adapter Implementation

- [ ] Adapter implements correct capability interfaces (see [PROVIDER_ADAPTER_GUIDE.md](./PROVIDER_ADAPTER_GUIDE.md))
- [ ] Adapter registered in `resolveProviderAdapter()`
- [ ] `validateConfiguration()` checks all required fields
- [ ] `testConnection()` makes a minimal live API call
- [ ] `getHealth()` returns accurate status
- [ ] All external calls gated by `assertProviderLiveCallsEnabled()`
- [ ] Retry/error handling uses `execution-policy.ts` helpers
- [ ] Request timeout respects `PROVIDER_REQUEST_TIMEOUT_MS` (30s)
- [ ] OAuth adapter implements full flow (if `OAUTH_CONNECT` capability)
- [ ] Webhook adapter implements signature verification (if `WEBHOOK_INGEST` capability)
- [ ] Idempotency keys forwarded on push operations

## 3. Security

- [ ] Credentials stored via `providerCredentialService.storeCredential()` only
- [ ] No plaintext secrets in `configuration` JSON, logs, or API responses
- [ ] Fingerprints displayed in UI (never full tokens/keys)
- [ ] Audit events recorded for all credential and connection operations
- [ ] `redactSecrets()` applied to all metadata before audit persistence
- [ ] Tenant isolation verified: all queries scoped by `organisationId`
- [ ] OAuth state signing uses dedicated `OAUTH_STATE_SIGNING_KEY` (production)
- [ ] Return URL allowlist covers all UI entry points for this provider
- [ ] Webhook signature verification implemented and tested
- [ ] Webhook timestamp tolerance enforced (5-minute window)

## 4. Environment Configuration

- [ ] Provider credentials configured per environment (see [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md))
- [ ] Separate OAuth apps for Dev, Preview, and Production
- [ ] `ENCRYPTION_KEY` unique per environment (min 32 chars)
- [ ] `APP_URL` set to correct canonical URL
- [ ] `OAUTH_CALLBACK_BASE_URL` registered in provider OAuth console
- [ ] `WEBHOOK_BASE_URL` registered in provider webhook console (if applicable)
- [ ] `PROVIDER_LIVE_CALLS_ENABLED` remains `false` until adapter validated
- [ ] No production credentials in Preview or Development environments
- [ ] `getIntegrationStatus()` reports provider as configured

## 5. Database and Permissions

- [ ] Prisma migration applied (provider models exist)
- [ ] RBAC permissions assigned to appropriate roles:
  - [ ] `providerConnections.read`
  - [ ] `providerConnections.create`
  - [ ] `providerConnections.authorize`
  - [ ] `providerConnections.revoke`
  - [ ] `providerConnections.test`
  - [ ] `providerConnections.viewAudit`
  - [ ] `providerConnections.manageWebhooks` (if webhook provider)
  - [ ] `providerConnections.manageCredentials`
- [ ] Connection ownership model decided (org-level, brand-level, or project-level)

## 6. API Routes

- [ ] `GET /api/providers/definitions` returns provider with correct `enabled` flag
- [ ] `POST /api/providers/connections` creates draft connections
- [ ] `POST /api/providers/connections/{id}` authorize action works end-to-end
- [ ] OAuth callback route implemented and tested (7.2+)
- [ ] Webhook ingestion route implemented and tested (7.2+, if applicable)
- [ ] All routes enforce `organisationId` and permissions

## 7. Testing

- [ ] Unit tests for adapter configuration validation
- [ ] Unit tests for OAuth state signing and PKCE (if OAuth)
- [ ] Unit tests for webhook signature verification (if webhooks)
- [ ] Unit tests for credential encryption round-trip
- [ ] Unit tests for return URL allowlist
- [ ] Integration test for connection create → authorize → connected flow
- [ ] Integration test for webhook ingest with valid/invalid signatures
- [ ] Integration test for duplicate webhook idempotency
- [ ] Integration test for tenant isolation (cross-org access denied)
- [ ] Manual test in Preview environment with sandbox credentials
- [ ] `npm run test:unit` passes
- [ ] `npm run test:integration` passes

## 8. Operational Readiness

- [ ] Error codes documented for this provider's failure modes
- [ ] Rate limit behavior documented (provider-specific limits)
- [ ] Token refresh strategy defined (proactive vs reactive)
- [ ] Re-authorization flow tested (`REAUTH_REQUIRED` status)
- [ ] Disconnect/revoke flow tested (credentials revoked, audit logged)
- [ ] Health check monitoring plan defined
- [ ] Circuit breaker thresholds appropriate for provider (`PROVIDER_CIRCUIT_FAILURE_THRESHOLD = 5`)
- [ ] Incident response runbook updated (if applicable)
- [ ] Data retention policy for webhook events and audit logs confirmed

## 9. Approval and Enablement

- [ ] `requiresApproval` gate satisfied (if `true` in definition)
- [ ] Stakeholder sign-off for production enablement
- [ ] Set `enabled: true` in `definitions.ts`
- [ ] Deploy to Preview with `PROVIDER_LIVE_CALLS_ENABLED=true`
- [ ] Validate full flow in Preview (connect, test, disconnect)
- [ ] Deploy to Production
- [ ] Set `PROVIDER_LIVE_CALLS_ENABLED=true` in Production
- [ ] Monitor audit events and health checks for 24 hours post-enablement

## 10. Post-Enablement Verification

- [ ] Create test connection in Production
- [ ] Verify `AUTHORIZATION_COMPLETED` audit event
- [ ] Verify credential fingerprint visible in UI (not plaintext)
- [ ] Verify `testConnection()` returns success
- [ ] Verify health check returns `HEALTHY`
- [ ] Verify webhook delivery (if applicable)
- [ ] Verify disconnect revokes credentials and logs audit event
- [ ] Remove test connection

## Quick Reference: Task 7.1 Baseline

At the 7.1 foundation, the following are already in place:

| Component | Status |
|-----------|--------|
| Provider registry (25 providers defined) | Done |
| Prisma models (11 tables) | Done |
| Connection service (CRUD, status) | Done |
| Credential service (encrypt, fingerprint, revoke) | Done |
| OAuth service (state, PKCE, signing — stub URL) | Done |
| Webhook service (verify, idempotency, tenant resolve) | Done |
| Audit service (redacted events) | Done |
| API routes (definitions, connections) | Done |
| Feature flags | Done |
| Execution policy (retry, timeout) | Done |
| Unit tests | Done |

Not yet in place (7.2+):

| Component | Status |
|-----------|--------|
| Live adapter implementations | Pending |
| OAuth callback route | Pending |
| Webhook HTTP route | Pending |
| Token exchange and refresh | Pending |
| Sync job orchestration | Pending |
| `enabled: true` for external providers | Pending |

## Currently Enabled Providers (7.1)

Only internal/data providers are enabled without live API calls:

| Provider | Key | Notes |
|----------|-----|-------|
| CSV Import | `csv-import` | `authType: NONE` |
| First-Party Crawler | `first-party-crawler` | `authType: INTERNAL` |

All other providers remain `enabled: false` until this checklist is completed per provider.

## Related Documentation

- [PROVIDER_INTEGRATION_ARCHITECTURE.md](./PROVIDER_INTEGRATION_ARCHITECTURE.md)
- [PROVIDER_ADAPTER_GUIDE.md](./PROVIDER_ADAPTER_GUIDE.md)
- [PROVIDER_SECURITY_MODEL.md](./PROVIDER_SECURITY_MODEL.md)
- [PROVIDER_ENVIRONMENT_MATRIX.md](./PROVIDER_ENVIRONMENT_MATRIX.md)
- [PROVIDER_CREDENTIAL_LIFECYCLE.md](./PROVIDER_CREDENTIAL_LIFECYCLE.md)
- [PROVIDER_OAUTH_FLOW.md](./PROVIDER_OAUTH_FLOW.md)
- [PROVIDER_WEBHOOK_STANDARD.md](./PROVIDER_WEBHOOK_STANDARD.md)
