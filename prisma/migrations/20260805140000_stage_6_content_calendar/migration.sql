-- Stage 6: Content Calendar

CREATE TYPE "CalendarEventType" AS ENUM (
  'CONTENT_PUBLICATION',
  'CAMPAIGN_START',
  'CAMPAIGN_END',
  'TASK_DEADLINE',
  'REVIEW',
  'MANUAL'
);

CREATE TYPE "CalendarEventStatus" AS ENUM (
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'TENTATIVE'
);

CREATE TABLE "CalendarEvent" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "campaignId" TEXT,
  "contentItemId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "CalendarEventType" NOT NULL,
  "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "allDay" BOOLEAN NOT NULL DEFAULT false,
  "timezone" TEXT NOT NULL,
  "color" TEXT,
  "location" TEXT,
  "sourceEntityType" TEXT,
  "sourceEntityId" TEXT,
  "sourceLocked" BOOLEAN NOT NULL DEFAULT false,
  "channelType" TEXT,
  "metadata" JSONB,
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarEvent_source_key"
  ON "CalendarEvent" ("organisationId", "sourceEntityType", "sourceEntityId", "type")
  WHERE "sourceEntityType" IS NOT NULL AND "sourceEntityId" IS NOT NULL;

CREATE INDEX "CalendarEvent_organisationId_brandId_startsAt_idx"
  ON "CalendarEvent" ("organisationId", "brandId", "startsAt");

CREATE INDEX "CalendarEvent_organisationId_startsAt_endsAt_idx"
  ON "CalendarEvent" ("organisationId", "startsAt", "endsAt");

CREATE INDEX "CalendarEvent_organisationId_status_idx"
  ON "CalendarEvent" ("organisationId", "status");

CREATE INDEX "CalendarEvent_organisationId_projectId_idx"
  ON "CalendarEvent" ("organisationId", "projectId");

CREATE INDEX "CalendarEvent_campaignId_idx"
  ON "CalendarEvent" ("campaignId");

CREATE INDEX "CalendarEvent_contentItemId_idx"
  ON "CalendarEvent" ("contentItemId");

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_brandId_fkey"
  FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_contentItemId_fkey"
  FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CalendarEvent"
  ADD CONSTRAINT "CalendarEvent_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
