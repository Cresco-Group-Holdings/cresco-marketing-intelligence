-- Task 6.5: Email Marketing Infrastructure and Deliverability Controls

-- CreateEnum
CREATE TYPE "EmailProviderType" AS ENUM ('AMAZON_SES', 'SENDGRID', 'MAILGUN', 'POSTMARK', 'RESEND', 'CUSTOM_SMTP');

-- CreateEnum
CREATE TYPE "EmailMessageCategory" AS ENUM ('ESSENTIAL_TRANSACTIONAL', 'ACCOUNT', 'SERVICE_OPERATIONAL', 'SALES_ONE_TO_ONE', 'MARKETING', 'NURTURE', 'NEWSLETTER', 'EVENT', 'CUSTOMER_SUCCESS', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailDomainSendingStatus" AS ENUM ('PENDING', 'VERIFYING', 'READY', 'SUSPENDED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDnsRecordStatus" AS ENUM ('UNKNOWN', 'PENDING', 'PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "EmailSenderVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EmailTemplateVersionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "EmailRecipientStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'SUPPRESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailDeliveryEventType" AS ENUM ('ACCEPTED', 'QUEUED', 'SENT', 'DELIVERED', 'DEFERRED', 'BOUNCED', 'COMPLAINED', 'OPENED', 'CLICKED', 'UNSUBSCRIBED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailSuppressionReason" AS ENUM ('UNSUBSCRIBE', 'HARD_BOUNCE', 'COMPLAINT', 'MANUAL', 'LEGAL_DELETION', 'INVALID_ADDRESS', 'PROVIDER_SUPPRESSION', 'TENANT_BLOCK');

-- CreateEnum
CREATE TYPE "EmailBounceType" AS ENUM ('HARD', 'SOFT');

-- CreateTable
CREATE TABLE "EmailProviderConnection" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "providerType" "EmailProviderType" NOT NULL,
    "name" TEXT NOT NULL,
    "credentialsRef" TEXT,
    "config" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "rateLimitPerMinute" INTEGER,
    "dailyQuota" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailProviderConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSendingDomain" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "providerConnectionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "sendingStatus" "EmailDomainSendingStatus" NOT NULL DEFAULT 'PENDING',
    "spfStatus" "EmailDnsRecordStatus" NOT NULL DEFAULT 'UNKNOWN',
    "dkimStatus" "EmailDnsRecordStatus" NOT NULL DEFAULT 'UNKNOWN',
    "dmarcStatus" "EmailDnsRecordStatus" NOT NULL DEFAULT 'UNKNOWN',
    "customReturnPath" TEXT,
    "providerVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "configInstructions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDomainVerification" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL,
    "status" "EmailDnsRecordStatus" NOT NULL DEFAULT 'PENDING',
    "recordName" TEXT,
    "recordValue" TEXT,
    "checkedAt" TIMESTAMP(3),
    "providerReference" TEXT,

    CONSTRAINT "EmailDomainVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSenderIdentity" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "domainId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "replyTo" TEXT,
    "purpose" TEXT,
    "verificationStatus" "EmailSenderVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "allowedCategories" "EmailMessageCategory"[],
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailSenderIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "EmailMessageCategory" NOT NULL,
    "currentVersionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "EmailTemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "htmlBody" TEXT NOT NULL,
    "plainTextBody" TEXT,
    "variables" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "requiresUnsubscribe" BOOLEAN NOT NULL DEFAULT false,
    "complianceFooter" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "providerConnectionId" TEXT,
    "senderIdentityId" TEXT NOT NULL,
    "templateId" TEXT,
    "templateVersionId" TEXT,
    "category" "EmailMessageCategory" NOT NULL,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" TEXT NOT NULL,
    "preheader" TEXT,
    "htmlBody" TEXT,
    "plainTextBody" TEXT,
    "idempotencyKey" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "EmailRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "leadId" TEXT,
    "contactId" TEXT,
    "variables" JSONB,
    "providerRecipientId" TEXT,

    CONSTRAINT "EmailMessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryEvent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "recipientId" TEXT,
    "eventType" "EmailDeliveryEventType" NOT NULL,
    "providerEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "idempotencyKey" TEXT,

    CONSTRAINT "EmailDeliveryEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "reason" "EmailSuppressionReason" NOT NULL,
    "source" TEXT,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailBounce" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "messageId" TEXT,
    "recipientId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "bounceType" "EmailBounceType" NOT NULL,
    "reason" TEXT,
    "providerReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailBounce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailComplaint" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "messageId" TEXT,
    "recipientId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "reason" TEXT,
    "providerReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailUnsubscribe" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "emailAddress" TEXT NOT NULL,
    "category" "EmailMessageCategory",
    "source" TEXT,
    "unsubscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailUnsubscribe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTrackingPolicy" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "openTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "clickTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "utmParameters" JSONB,
    "firstPartyRedirectEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "restrictedRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTrackingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailProviderWebhook" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "providerConnectionId" TEXT NOT NULL,
    "endpointSecretRef" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastReceivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailProviderWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliverabilitySnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "domainId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "deliveredCount" INTEGER NOT NULL DEFAULT 0,
    "bounceCount" INTEGER NOT NULL DEFAULT 0,
    "hardBounceCount" INTEGER NOT NULL DEFAULT 0,
    "complaintCount" INTEGER NOT NULL DEFAULT 0,
    "unsubscribeCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "deliveryRate" DECIMAL(65,30),
    "bounceRate" DECIMAL(65,30),
    "complaintRate" DECIMAL(65,30),
    "warnings" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliverabilitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailProviderConnection_organisationId_providerType_idx" ON "EmailProviderConnection"("organisationId", "providerType");

-- CreateIndex
CREATE INDEX "EmailProviderConnection_brandId_idx" ON "EmailProviderConnection"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSendingDomain_organisationId_domain_key" ON "EmailSendingDomain"("organisationId", "domain");

-- CreateIndex
CREATE INDEX "EmailSendingDomain_brandId_idx" ON "EmailSendingDomain"("brandId");

-- CreateIndex
CREATE INDEX "EmailSendingDomain_sendingStatus_idx" ON "EmailSendingDomain"("sendingStatus");

-- CreateIndex
CREATE INDEX "EmailDomainVerification_domainId_idx" ON "EmailDomainVerification"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSenderIdentity_organisationId_emailAddress_key" ON "EmailSenderIdentity"("organisationId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailSenderIdentity_brandId_idx" ON "EmailSenderIdentity"("brandId");

-- CreateIndex
CREATE INDEX "EmailSenderIdentity_verificationStatus_idx" ON "EmailSenderIdentity"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_organisationId_slug_key" ON "EmailTemplate"("organisationId", "slug");

-- CreateIndex
CREATE INDEX "EmailTemplate_brandId_idx" ON "EmailTemplate"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplateVersion_templateId_versionNumber_key" ON "EmailTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "EmailTemplateVersion_templateId_status_idx" ON "EmailTemplateVersion"("templateId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_organisationId_idempotencyKey_key" ON "EmailMessage"("organisationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailMessage_organisationId_brandId_status_idx" ON "EmailMessage"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "EmailMessage_scheduledAt_idx" ON "EmailMessage"("scheduledAt");

-- CreateIndex
CREATE INDEX "EmailMessage_senderIdentityId_idx" ON "EmailMessage"("senderIdentityId");

-- CreateIndex
CREATE INDEX "EmailMessageRecipient_messageId_idx" ON "EmailMessageRecipient"("messageId");

-- CreateIndex
CREATE INDEX "EmailMessageRecipient_emailAddress_idx" ON "EmailMessageRecipient"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "EmailDeliveryEvent_providerEventId_eventType_key" ON "EmailDeliveryEvent"("providerEventId", "eventType");

-- CreateIndex
CREATE INDEX "EmailDeliveryEvent_messageId_occurredAt_idx" ON "EmailDeliveryEvent"("messageId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_organisationId_emailAddress_key" ON "EmailSuppression"("organisationId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailSuppression_brandId_idx" ON "EmailSuppression"("brandId");

-- CreateIndex
CREATE INDEX "EmailBounce_organisationId_emailAddress_idx" ON "EmailBounce"("organisationId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailBounce_messageId_idx" ON "EmailBounce"("messageId");

-- CreateIndex
CREATE INDEX "EmailComplaint_organisationId_emailAddress_idx" ON "EmailComplaint"("organisationId", "emailAddress");

-- CreateIndex
CREATE INDEX "EmailComplaint_messageId_idx" ON "EmailComplaint"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailUnsubscribe_organisationId_emailAddress_category_key" ON "EmailUnsubscribe"("organisationId", "emailAddress", "category");

-- CreateIndex
CREATE INDEX "EmailUnsubscribe_brandId_idx" ON "EmailUnsubscribe"("brandId");

-- CreateIndex
CREATE INDEX "EmailTrackingPolicy_organisationId_brandId_idx" ON "EmailTrackingPolicy"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "EmailProviderWebhook_providerConnectionId_idx" ON "EmailProviderWebhook"("providerConnectionId");

-- CreateIndex
CREATE INDEX "EmailDeliverabilitySnapshot_organisationId_brandId_computedAt_idx" ON "EmailDeliverabilitySnapshot"("organisationId", "brandId", "computedAt");

-- AddForeignKey
ALTER TABLE "EmailProviderConnection" ADD CONSTRAINT "EmailProviderConnection_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProviderConnection" ADD CONSTRAINT "EmailProviderConnection_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSendingDomain" ADD CONSTRAINT "EmailSendingDomain_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSendingDomain" ADD CONSTRAINT "EmailSendingDomain_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSendingDomain" ADD CONSTRAINT "EmailSendingDomain_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "EmailProviderConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDomainVerification" ADD CONSTRAINT "EmailDomainVerification_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "EmailSendingDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSenderIdentity" ADD CONSTRAINT "EmailSenderIdentity_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSenderIdentity" ADD CONSTRAINT "EmailSenderIdentity_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSenderIdentity" ADD CONSTRAINT "EmailSenderIdentity_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "EmailSendingDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplate" ADD CONSTRAINT "EmailTemplate_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTemplateVersion" ADD CONSTRAINT "EmailTemplateVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "EmailProviderConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_senderIdentityId_fkey" FOREIGN KEY ("senderIdentityId") REFERENCES "EmailSenderIdentity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "EmailTemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessageRecipient" ADD CONSTRAINT "EmailMessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryEvent" ADD CONSTRAINT "EmailDeliveryEvent_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "EmailMessageRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailSuppression" ADD CONSTRAINT "EmailSuppression_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailBounce" ADD CONSTRAINT "EmailBounce_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "EmailMessageRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailComplaint" ADD CONSTRAINT "EmailComplaint_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "EmailMessageRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailUnsubscribe" ADD CONSTRAINT "EmailUnsubscribe_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailUnsubscribe" ADD CONSTRAINT "EmailUnsubscribe_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTrackingPolicy" ADD CONSTRAINT "EmailTrackingPolicy_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTrackingPolicy" ADD CONSTRAINT "EmailTrackingPolicy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProviderWebhook" ADD CONSTRAINT "EmailProviderWebhook_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailProviderWebhook" ADD CONSTRAINT "EmailProviderWebhook_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "EmailProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliverabilitySnapshot" ADD CONSTRAINT "EmailDeliverabilitySnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliverabilitySnapshot" ADD CONSTRAINT "EmailDeliverabilitySnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliverabilitySnapshot" ADD CONSTRAINT "EmailDeliverabilitySnapshot_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "EmailSendingDomain"("id") ON DELETE SET NULL ON UPDATE CASCADE;
