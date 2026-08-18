# Worker Platform Architecture

Cresco Marketing Intelligence uses **one canonical background execution platform** for delayed, recurring, retryable, and asynchronous work.

## Flow

```
Scheduler / Trigger
  → Job Dispatcher (`dispatchDueJobs`)
  → WorkerJob record (Prisma)
  → Atomic claim (`claimDueJobs` with SKIP LOCKED)
  → Worker Executor (`processAvailableJobs`)
  → Typed handler registry
  → Success / Retry / Dead letter
  → Observability
```

## Canonical primitives

| Component | Location |
|-----------|----------|
| Job model | `WorkerJob` in `prisma/schema.prisma` |
| Lifecycle | `src/lib/workers/lifecycle.ts` |
| Dispatcher | `src/server/services/worker-dispatcher-service.ts` |
| Executor | `src/server/services/worker-executor-service.ts` |
| Handler registry | `src/server/services/worker-handler-registry.ts` |
| API triggers | `/api/workers/dispatch`, `/api/workers/process`, `/api/workers/recover` |

## Job types

- `PUBLISHING` → `processPublicationPublishingJob`
- `TOKEN_REFRESH` → `tokenLifecycleService.refreshConnectionTokens`
- `ANALYTICS_SYNC` → `socialAnalyticsSyncService.process`
- `PROVIDER_SYNC` → `providerSyncEngineService.executeSyncRun`
- `DAM_PROCESSING` → `digitalAssetProcessingService.processDueJobs`
- `SEO_CRAWL` → `seoCrawlService.process`
- `AUTOMATION_EXECUTION` → reserved for async automation resume
- `NOTIFICATION_DIGEST` → `notificationDigestService.processDue`

## Legacy consolidation

Feature-specific schedulers (`publishing-scheduler`, `social-analytics-sync`, `daily-dispatch`) remain as **thin wrappers** that call the canonical dispatcher/executor. Domain business logic stays in feature services.

## Scheduling

- **Vercel Hobby**: once-daily `/api/cron/daily-dispatch` fans out bounded batches.
- **GitHub Actions**: `.github/workflows/worker-platform-scheduler.yml` every 6 hours (`environment: production`).
- **Manual / external**: call `/api/workers/dispatch` then `/api/workers/process`.

High-frequency target cadences are documented in `src/lib/deployment/scheduling.ts` for future Vercel Pro or Cloudflare Cron portability.
