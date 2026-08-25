-- Task 6.1: Platform scheduler heartbeat (raw SQL table, no Prisma model required)
CREATE TABLE IF NOT EXISTS "SchedulerHeartbeat" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lastInvokedAt" TIMESTAMPTZ NOT NULL,
  "lastSucceededAt" TIMESTAMPTZ,
  "invocationType" TEXT NOT NULL,
  "jobsDiscovered" INTEGER NOT NULL DEFAULT 0,
  "jobsCreated" INTEGER NOT NULL DEFAULT 0,
  "jobsActivated" INTEGER NOT NULL DEFAULT 0,
  "jobsClaimed" INTEGER NOT NULL DEFAULT 0,
  "jobsSucceeded" INTEGER NOT NULL DEFAULT 0,
  "oldestReadyDueAt" TIMESTAMPTZ,
  "metadata" JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "SchedulerHeartbeat_lastInvokedAt_idx"
  ON "SchedulerHeartbeat" ("lastInvokedAt");
