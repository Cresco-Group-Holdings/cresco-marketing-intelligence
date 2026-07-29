-- Business-local reporting timezone for social analytics aggregation.
ALTER TABLE "Brand" ADD COLUMN "analyticsTimezone" TEXT;

-- Worker lease, crash recovery, credential refresh and historical backfill state.
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "refreshAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "recoveryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "maxRecoveries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "workerId" TEXT;
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "backfillFrom" TIMESTAMP(3);
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "backfillTo" TIMESTAMP(3);
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "backfillCompleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SocialAnalyticsSync" ADD COLUMN "lastError" TEXT;

CREATE INDEX "SocialAnalyticsSync_status_leaseExpiresAt_idx" ON "SocialAnalyticsSync"("status","leaseExpiresAt");
CREATE INDEX "SocialAnalyticsSync_status_nextRetryAt_idx" ON "SocialAnalyticsSync"("status","nextRetryAt");

-- Provider-discovered posts carry their own publish timestamp and discovery provenance.
ALTER TABLE "SocialPostMetric" ADD COLUMN "providerPublishedAt" TIMESTAMP(3);
ALTER TABLE "SocialPostMetric" ADD COLUMN "discoverySource" TEXT NOT NULL DEFAULT 'PLATFORM_PUBLISHING';

-- Analytics errors record the provider, which sync phase failed, and whether it is terminal.
ALTER TABLE "SocialAnalyticsError" ADD COLUMN "provider" "SocialProvider";
ALTER TABLE "SocialAnalyticsError" ADD COLUMN "syncPhase" TEXT NOT NULL DEFAULT 'POST_METRICS';
ALTER TABLE "SocialAnalyticsError" ADD COLUMN "terminal" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "SocialAnalyticsError_provider_category_idx" ON "SocialAnalyticsError"("provider","category");
