# Publishing Architecture

Cresco uses a **single canonical publishing path** for outbound social content:

```
ContentItem / ContentVariant
  → Publication (intent + lifecycle)
  → PublishingJob (executable work unit)
  → PublicationAttempt (provider execution)
  → ProviderConnection
  → tokenLifecycleService.getValidAccessToken()
  → Platform publishing adapter (meta)
  → external platform
  → externalPublicationId persisted
  → analytics attribution
```

## Authoritative models

| Model | Role |
|-------|------|
| `Publication` | Customer intent, governance, scheduling, status |
| `PublishingJob` | Background/worker execution unit (linked via `publicationId`) |
| `PublicationAttempt` | One provider API execution attempt |
| `ProviderConnection` | Authenticated external account (Task 1) |
| `CalendarEvent` | **Projection** of scheduled `Publication` records |

## Legacy path (deprecated for new work)

Stage-2 `ContentSchedule` → `PublishingJob` → per-provider services (`instagramPublishingService`, etc.) remains for backward compatibility. New features must use `canonicalPublicationService`.

## Services

| Service | Responsibility |
|---------|----------------|
| `canonicalPublicationService` | `publishNow`, `schedulePublication`, `cancel`, `reschedule`, `retry` |
| `processPublicationPublishingJob` | Worker entry point — sole production execution path for `Publication` |
| `publicationExecutionService` | Thin wrapper; delegates execute/retry to worker |
| `providerGateway` | Provider adapter resolution + token lifecycle |
| `publishingSchedulerService` | Enqueues due publications + drains jobs |

## Task 1 dependency

Publishing never reads `ProviderCredential` directly. Tokens are obtained only via `tokenLifecycleService.getValidAccessToken()`.

## Mock policy

- Production: real adapters for `meta` / `meta-ads`
- Mocks (`mock-social`, `mock-advertising`): tests or `ALLOW_PUBLISHING_MOCK=true` only

## UI entry points

- Content Studio: `CanonicalPublishPanel` → `/api/brands/.../content/.../publish`
- `/publishing`: publication queue + composer
- `/social`: redirects to `/publishing`
- Calendar: projects `Publication` with `sourceEntityType=Publication`

## Related docs

- [Publication Lifecycle](./PUBLICATION_LIFECYCLE.md)
- [Worker Contract](./WORKER_CONTRACT.md)
- [Provider Adapters](./PROVIDER_ADAPTERS.md)
