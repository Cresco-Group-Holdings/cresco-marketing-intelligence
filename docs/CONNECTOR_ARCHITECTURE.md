# Connector Architecture

Task 1.8 establishes the Marketing Data Hub connector framework. External marketing platforms are integrated through adapters without rewriting the application core.

## Layers

1. **Connector registry** (`src/lib/connectors/registry.ts`) — catalogue of supported platforms, required scopes, and platform availability.
2. **Connector services** (`src/server/services/connector-*.ts`) — tenant-scoped account lifecycle, credential storage, OAuth, and sync orchestration.
3. **Connector adapters** (`src/lib/connectors/adapters/`) — provider-specific OAuth and sync implementations.
4. **Sync engine** (`src/lib/connectors/sync/`) — generic initial/incremental sync, retries, cursors, cancellation, and dead-letter reporting.
5. **Job provider abstraction** (`src/lib/jobs/`) — database-backed jobs for production; synchronous runner for local development and tests.
6. **Normalised data layer** (`src/lib/connectors/normalized-data.ts`) — canonical marketing concepts with provider-specific metadata extension points.

## Data models

| Model | Scope | Purpose |
|-------|-------|---------|
| `ConnectorDefinition` | Global | Platform catalogue and required scopes |
| `ConnectorAccount` | Brand | Connected account status and public metadata |
| `ConnectorCredential` | Brand | Encrypted OAuth tokens |
| `ConnectorSync` | Brand | Sync run history and idempotency |
| `ConnectorSyncCursor` | Brand | Cursor-based pagination state |
| `ConnectorError` | Brand | Error audit trail |
| `WebhookEndpoint` | Brand | Incoming webhook registration |
| `WebhookEvent` | Endpoint | Idempotent webhook processing |
| `ConnectorOAuthState` | Brand | OAuth state and PKCE verifier storage |

All tenant-owned records include `organisationId`, `projectId`, and `brandId`.

## Status model

Connector account statuses:

- `NOT_CONFIGURED`
- `AVAILABLE`
- `CONNECTING`
- `CONNECTED`
- `ERROR`
- `REAUTH_REQUIRED`
- `DISABLED`

Platform catalogue entries also expose `COMING_SOON` vs `AVAILABLE` platform availability. Placeholder connectors are visible in the UI but cannot be connected until adapters are implemented.

## API surface

Brand-scoped routes under `/api/brands/[brandId]/connectors`:

- `GET /` — catalogue
- `GET /[connectorType]` — detail, recent syncs, recent errors
- `POST /[connectorType]/connect` — begin OAuth
- `POST /[connectorType]/complete` — complete OAuth callback
- `POST /[connectorType]/disconnect` — revoke and delete credentials
- `POST /[connectorType]/reconnect` — refresh tokens
- `POST /[connectorType]/sync` — trigger sync

Permissions: `connectors.read`, `connectors.update`.

## Adding a new provider

1. Add enum value to `ConnectorType` if needed.
2. Seed or update `ConnectorDefinition`.
3. Register adapter in `src/lib/connectors/adapters/`.
4. Set `platformAvailability` to `AVAILABLE`.
5. Implement OAuth scopes and sync mapping to normalised concepts.

No changes are required in UI, credential storage, sync engine, or tenant isolation logic.
