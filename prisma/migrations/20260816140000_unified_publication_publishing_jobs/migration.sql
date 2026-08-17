-- Link canonical Publication records to PublishingJob execution units.

ALTER TABLE "PublishingJob" ALTER COLUMN "contentScheduleId" DROP NOT NULL;

ALTER TABLE "PublishingJob" ADD COLUMN IF NOT EXISTS "publicationId" TEXT;

ALTER TABLE "PublishingJob"
  ADD CONSTRAINT "PublishingJob_publicationId_fkey"
  FOREIGN KEY ("publicationId") REFERENCES "Publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "PublishingJob_publicationId_idempotencyKey_key"
  ON "PublishingJob"("publicationId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "PublishingJob_publicationId_idx" ON "PublishingJob"("publicationId");
CREATE INDEX IF NOT EXISTS "PublishingJob_organisationId_status_idx" ON "PublishingJob"("organisationId", "status");
