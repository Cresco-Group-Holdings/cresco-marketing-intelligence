# Sync Engine

The generic sync framework lives in `src/lib/connectors/sync/` and is orchestrated by `connector-sync-service`.

## Capabilities

- Initial and incremental sync types
- Cursor-based pagination with persisted `ConnectorSyncCursor`
- Scheduled sync support via the job provider abstraction
- Retries with exponential backoff and provider rate-limit handling
- Idempotency through `ConnectorSync.idempotencyKey`
- Cancellation hook via `shouldCancel`
- Dead-letter style error recording in `ConnectorError`
- Partial failure reporting via `PARTIAL` sync status and per-page failure counters

## Execution flow

1. `connectorSyncService.startSync()` validates tenant scope and account credentials.
2. A `ConnectorSync` row is created (or an existing idempotent row is returned).
3. `runConnectorSync()` pages data through the provider adapter.
4. Each page updates sync counters and optional cursor state.
5. Final status updates account `lastSuccessfulSyncAt` or error fields.

## Job execution

Production must use a persistent job provider (`DatabaseJobProvider`). Local development and tests may use `SynchronousJobRunner`, which executes jobs inline and is not used in production paths.

## Adapter contract

Provider adapters implement:

- `fetchPage()` — cursor-based page retrieval
- `mapPageToSyncResult()` — normalised per-page counters
- OAuth token lifecycle methods for connection management

Fake adapters in `src/lib/connectors/adapters/fake-connector-adapter.ts` support automated tests without live services.
