export function publishingJobIdempotencyKey(publicationId: string): string {
  return `publication:${publicationId}:publish`;
}

export function tokenRefreshJobIdempotencyKey(connectionId: string, windowStart: Date): string {
  return `connection:${connectionId}:refresh:${windowStart.toISOString()}`;
}

export function analyticsSyncJobIdempotencyKey(syncId: string): string {
  return `analytics:${syncId}:sync`;
}

export function providerSyncJobIdempotencyKey(syncRunId: string): string {
  return `provider-sync:${syncRunId}:run`;
}

export function damProcessingJobIdempotencyKey(assetId: string, jobType: string, version: number): string {
  return `asset:${assetId}:process:${jobType}:v${version}`;
}

export function seoCrawlJobIdempotencyKey(runId: string): string {
  return `seo-crawl:${runId}:run`;
}

export function automationExecutionJobIdempotencyKey(executionId: string): string {
  return `automation:${executionId}:execute`;
}

export function notificationDigestJobIdempotencyKey(
  organisationId: string,
  period: string,
  windowStart: Date,
): string {
  return `notification:${organisationId}:digest:${period}:${windowStart.toISOString()}`;
}
