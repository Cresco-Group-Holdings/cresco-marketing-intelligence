# Publishing Troubleshooting

## Publication stuck in QUEUED

- Check `PublishingJob` exists with `publicationId`
- Run `processPublicationPublishingJob(jobId)` manually
- Verify scheduler is enabled (`publishingSchedulerService`)

## REAUTH_REQUIRED

- Provider connection token expired or revoked
- Reconnect in Integrations
- Retry publication after reconnect

## Missing media

- Content must have approved `MarketingAsset` records linked via `ContentAsset`
- Assets must be `READY` status

## Meta misconfiguration

- Verify `META_APP_ID`, `META_APP_SECRET`, `APP_URL`
- Instagram business account must be selected on connection

## Duplicate post prevented

- Idempotency key collision — expected behavior
- Check `publishing.duplicate_prevented` metric

## Calendar drift

- Calendar events are projections from `Publication`
- Call `calendarProjectionService.syncPublication(publicationId)` to refresh

## Notification failed but post published

- Expected — notifications are best-effort
- Publication status remains `PUBLISHED`
