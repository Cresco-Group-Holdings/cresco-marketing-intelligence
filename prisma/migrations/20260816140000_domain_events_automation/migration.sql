-- Extend automation event types for domain event triggers
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'PUBLICATION_FAILED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'PUBLICATION_SUCCEEDED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'PUBLICATION_REAUTH_REQUIRED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'LEAD_CREATED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'LEAD_QUALIFIED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'BUDGET_THRESHOLD_REACHED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'PROVIDER_SYNC_FAILED';
ALTER TYPE "AutomationEventType" ADD VALUE IF NOT EXISTS 'ANALYTICS_THRESHOLD_BREACHED';

CREATE TYPE "DomainEventOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSED',
  'FAILED',
  'NO_AUTOMATION'
);

CREATE TABLE "DomainEventOutbox" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT,
  "causationId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "status" "DomainEventOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "processedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "automationResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DomainEventOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DomainEventOutbox_idempotencyKey_key" ON "DomainEventOutbox"("idempotencyKey");
CREATE INDEX "DomainEventOutbox_brandId_status_occurredAt_idx" ON "DomainEventOutbox"("brandId", "status", "occurredAt");
CREATE INDEX "DomainEventOutbox_organisationId_occurredAt_idx" ON "DomainEventOutbox"("organisationId", "occurredAt");

ALTER TABLE "DomainEventOutbox" ADD CONSTRAINT "DomainEventOutbox_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DomainEventOutbox" ADD CONSTRAINT "DomainEventOutbox_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DomainEventOutbox" ADD CONSTRAINT "DomainEventOutbox_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
