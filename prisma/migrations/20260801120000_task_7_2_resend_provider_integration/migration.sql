-- Task 7.2: Resend Provider Integration

-- Extend ProviderCapabilityType
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'EMAIL_BATCH_SEND';
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'EMAIL_DELIVERY_EVENTS';
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'EMAIL_DOMAIN_STATUS';
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'WEBHOOK_RECEIVE';
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'CONNECTION_TEST';
ALTER TYPE "ProviderCapabilityType" ADD VALUE IF NOT EXISTS 'HEALTH_CHECK';

-- Extend ProviderAuditAction
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_SEND_ATTEMPTED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_SEND_ACCEPTED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_SEND_REJECTED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'EMAIL_SEND_SIMULATED';
ALTER TYPE "ProviderAuditAction" ADD VALUE IF NOT EXISTS 'SUPPRESSION_APPLIED';

-- Outbound send idempotency tracking
CREATE TYPE "ProviderOutboundSendStatus" AS ENUM ('PENDING', 'SUBMITTING', 'ACCEPTED', 'FAILED', 'SIMULATED', 'DUPLICATE');

CREATE TABLE "ProviderOutboundSend" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "connectionId" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "messageType" TEXT,
    "status" "ProviderOutboundSendStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "safeErrorCode" TEXT,
    "requestId" TEXT,
    "approvalId" TEXT,
    "campaignId" TEXT,
    "recipientId" TEXT,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOutboundSend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderOutboundSend_organisationId_connectionId_idempotencyKey_key" ON "ProviderOutboundSend"("organisationId", "connectionId", "idempotencyKey");
CREATE INDEX "ProviderOutboundSend_organisationId_providerKey_idx" ON "ProviderOutboundSend"("organisationId", "providerKey");
CREATE INDEX "ProviderOutboundSend_connectionId_status_idx" ON "ProviderOutboundSend"("connectionId", "status");
CREATE INDEX "ProviderOutboundSend_providerMessageId_idx" ON "ProviderOutboundSend"("providerMessageId");

ALTER TABLE "ProviderOutboundSend" ADD CONSTRAINT "ProviderOutboundSend_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
