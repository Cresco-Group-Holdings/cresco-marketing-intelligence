# Organic Social End-to-End Journey

## Customer journey (canonical path)

1. **Integrations** → Meta → Connect (real OAuth via `meta-oauth-adapter`)
2. OAuth callback → account discovery → **select Instagram Business account**
3. `ProviderConnection` status `CONNECTED`
4. **Content Studio** → create content → attach approved media → approve
5. **Publish panel** → select connection + Instagram account → preflight validation
6. **Post now** or **Schedule** (workspace timezone displayed, UTC persisted)
7. `Publication` + `PublishingJob` created
8. `processPublicationPublishingJob()` claims job (advisory lock, idempotent)
9. `tokenLifecycleService` supplies access token
10. `meta-social-publishing-adapter` → Meta Graph API (container poll → publish)
11. `externalPublicationId` + permalink persisted; status `PUBLISHED`
12. `publicationAnalyticsSyncService` enqueues metrics sync
13. Metrics visible on `/publishing` and publication detail

## Architecture

| Layer | Implementation |
|-------|----------------|
| OAuth | `ProviderConnection` + Stage 12 integrations |
| Publishing | `canonicalPublicationService` → `publication-publishing-worker` |
| Adapter | `meta-social-publishing-adapter` (production; mock blocked) |
| Scheduler | `publishingSchedulerService.runSchedulerPass` |
| Analytics | `publicationAnalyticsSyncService` → `InstagramAnalyticsAdapter` |
| Calendar | `calendarProjectionService.syncPublication` |

## Routes

- `/integrations` — connect Meta, account selection, health
- `/content/studio/[id]` — approve + publish panel
- `/publishing` — history, retry, metrics refresh
- `/social` — redirects to `/publishing`
- `/calendar` — scheduled/published projection

## Gaps / live E2E requirements

Live Meta sandbox E2E requires `META_APP_ID`, `META_APP_SECRET`, and a test Instagram Business account. See `META_SCOPES_AND_APP_REVIEW.md`.

Legacy `SocialConnection` path remains for backward compatibility but is **not** the canonical organic social path.
