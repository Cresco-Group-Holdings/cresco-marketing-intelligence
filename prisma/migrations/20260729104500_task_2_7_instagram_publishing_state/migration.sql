ALTER TABLE "PublishingJob" ADD COLUMN "providerContainerId" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "providerStatus" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "pollingAttemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PublishingJob" ADD COLUMN "nextPollAt" TIMESTAMP(3);
ALTER TABLE "PublishingJob" ADD COLUMN "lastProviderError" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "publishedMediaId" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "permalink" TEXT;
ALTER TABLE "PublishingJob" ADD COLUMN "refreshAttemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "PublishingJob_publishedMediaId_key" ON "PublishingJob"("publishedMediaId");
