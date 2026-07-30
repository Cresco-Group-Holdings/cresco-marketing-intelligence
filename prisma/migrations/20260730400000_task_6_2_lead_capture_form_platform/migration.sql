-- Task 6.2: Lead Capture and Form Platform

-- CreateEnum
CREATE TYPE "LeadCaptureFormStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadCaptureFormType" AS ENUM ('CONTACT', 'DEMO_REQUEST', 'WAITLIST', 'NEWSLETTER', 'DOWNLOAD', 'EVENT_REGISTRATION', 'GRANT_INTEREST', 'CAPITAL_ANALYSIS_REQUEST', 'PARTNERSHIP', 'SUPPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeadCaptureFieldType" AS ENUM ('TEXT', 'EMAIL', 'PHONE', 'TEXTAREA', 'NUMBER', 'DATE', 'SINGLE_SELECT', 'MULTI_SELECT', 'CHECKBOX', 'RADIO', 'COUNTRY', 'LANGUAGE', 'COMPANY', 'JOB_TITLE', 'URL', 'HIDDEN', 'CONSENT', 'FILE_UPLOAD');

-- CreateEnum
CREATE TYPE "LeadCaptureSubmissionStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'ACCEPTED', 'QUARANTINED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "LeadCaptureConsentPurpose" AS ENUM ('SERVICE_REQUEST', 'MARKETING_EMAIL', 'MARKETING_PHONE', 'PERSONALISED_MARKETING', 'ADVERTISING_AUDIENCE', 'PARTNER_COMMUNICATIONS');

-- CreateEnum
CREATE TYPE "LeadCaptureConsentState" AS ENUM ('GRANTED', 'DENIED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LeadCaptureThankYouActionType" AS ENUM ('INLINE_CONFIRMATION', 'REDIRECT', 'CALENDAR_BOOKING', 'RESOURCE_DOWNLOAD', 'ACCOUNT_REGISTRATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "LeadCaptureRuleActionType" AS ENUM ('ASSIGN_OWNER', 'APPLY_TAG', 'SET_PRODUCT_INTEREST', 'CREATE_TASK', 'ADD_NURTURE', 'NOTIFY_TEAM', 'CREATE_OPPORTUNITY_PROPOSAL');

-- CreateEnum
CREATE TYPE "LeadCaptureEmbedType" AS ENUM ('JAVASCRIPT', 'IFRAME', 'HOSTED_PAGE', 'REACT_COMPONENT', 'API');

-- CreateEnum
CREATE TYPE "LeadCaptureSpamVerdict" AS ENUM ('CLEAN', 'SUSPICIOUS', 'QUARANTINED');

-- CreateTable
CREATE TABLE "LeadCaptureForm" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "publicFormId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "formType" "LeadCaptureFormType" NOT NULL DEFAULT 'CONTACT',
    "status" "LeadCaptureFormStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "currentVersionId" TEXT,
    "allowedOrigins" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandStyling" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "LeadCaptureForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureFormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "successMessage" TEXT,
    "errorMessage" TEXT,
    "multiStep" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureFormStep" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadCaptureFormStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureField" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "stepId" TEXT,
    "fieldKey" TEXT NOT NULL,
    "fieldType" "LeadCaptureFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "placeholder" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "validationRules" JSONB,
    "conditionalVisibility" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isHoneypot" BOOLEAN NOT NULL DEFAULT false,
    "consentPurpose" "LeadCaptureConsentPurpose",

    CONSTRAINT "LeadCaptureField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureFieldOption" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadCaptureFieldOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureConsentBlock" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "purpose" "LeadCaptureConsentPurpose" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "helpText" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadCaptureConsentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureSubmission" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "status" "LeadCaptureSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "idempotencyKey" TEXT,
    "receiptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageUrl" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "campaignId" TEXT,
    "adClickId" TEXT,
    "socialContentId" TEXT,
    "anonymousId" TEXT,
    "sessionId" TEXT,
    "trackingPropertyId" TEXT,
    "origin" TEXT,
    "clientIpHash" TEXT,
    "userAgent" TEXT,
    "crmLeadId" TEXT,
    "attributionJourneyId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureSubmissionConsent" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "purpose" "LeadCaptureConsentPurpose" NOT NULL,
    "state" "LeadCaptureConsentState" NOT NULL,
    "wordingVersion" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "formVersionId" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureSubmissionConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureSubmissionValue" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "valueText" TEXT,
    "valueJson" JSONB,

    CONSTRAINT "LeadCaptureSubmissionValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureDestination" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureRule" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "actionType" "LeadCaptureRuleActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureSpamAssessment" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "verdict" "LeadCaptureSpamVerdict" NOT NULL DEFAULT 'CLEAN',
    "signals" JSONB,
    "score" DECIMAL(5,2),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureSpamAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureEmbedInstallation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "embedType" "LeadCaptureEmbedType" NOT NULL,
    "domain" TEXT,
    "config" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "LeadCaptureEmbedInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadCaptureThankYouAction" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "versionId" TEXT,
    "actionType" "LeadCaptureThankYouActionType" NOT NULL DEFAULT 'INLINE_CONFIRMATION',
    "config" JSONB,
    "redirectUrl" TEXT,
    "isRedirectValidated" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureThankYouAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureForm_publicFormId_key" ON "LeadCaptureForm"("publicFormId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureForm_brandId_slug_key" ON "LeadCaptureForm"("brandId", "slug");

-- CreateIndex
CREATE INDEX "LeadCaptureForm_organisationId_brandId_status_idx" ON "LeadCaptureForm"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "LeadCaptureForm_publicFormId_idx" ON "LeadCaptureForm"("publicFormId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureFormVersion_formId_versionNumber_key" ON "LeadCaptureFormVersion"("formId", "versionNumber");

-- CreateIndex
CREATE INDEX "LeadCaptureFormVersion_formId_isActive_idx" ON "LeadCaptureFormVersion"("formId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureFormStep_versionId_stepNumber_key" ON "LeadCaptureFormStep"("versionId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureField_versionId_fieldKey_key" ON "LeadCaptureField"("versionId", "fieldKey");

-- CreateIndex
CREATE INDEX "LeadCaptureField_versionId_sortOrder_idx" ON "LeadCaptureField"("versionId", "sortOrder");

-- CreateIndex
CREATE INDEX "LeadCaptureFieldOption_fieldId_sortOrder_idx" ON "LeadCaptureFieldOption"("fieldId", "sortOrder");

-- CreateIndex
CREATE INDEX "LeadCaptureConsentBlock_versionId_idx" ON "LeadCaptureConsentBlock"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureSubmission_formId_idempotencyKey_key" ON "LeadCaptureSubmission"("formId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "LeadCaptureSubmission_organisationId_brandId_status_idx" ON "LeadCaptureSubmission"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "LeadCaptureSubmission_formId_createdAt_idx" ON "LeadCaptureSubmission"("formId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadCaptureSubmission_crmLeadId_idx" ON "LeadCaptureSubmission"("crmLeadId");

-- CreateIndex
CREATE INDEX "LeadCaptureSubmissionConsent_submissionId_idx" ON "LeadCaptureSubmissionConsent"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureSubmissionValue_submissionId_fieldId_key" ON "LeadCaptureSubmissionValue"("submissionId", "fieldId");

-- CreateIndex
CREATE INDEX "LeadCaptureSubmissionValue_submissionId_idx" ON "LeadCaptureSubmissionValue"("submissionId");

-- CreateIndex
CREATE INDEX "LeadCaptureDestination_formId_idx" ON "LeadCaptureDestination"("formId");

-- CreateIndex
CREATE INDEX "LeadCaptureRule_formId_priority_idx" ON "LeadCaptureRule"("formId", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "LeadCaptureSpamAssessment_submissionId_key" ON "LeadCaptureSpamAssessment"("submissionId");

-- CreateIndex
CREATE INDEX "LeadCaptureEmbedInstallation_formId_idx" ON "LeadCaptureEmbedInstallation"("formId");

-- CreateIndex
CREATE INDEX "LeadCaptureThankYouAction_formId_idx" ON "LeadCaptureThankYouAction"("formId");

-- AddForeignKey
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureFormVersion" ADD CONSTRAINT "LeadCaptureFormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureFormVersion" ADD CONSTRAINT "LeadCaptureFormVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureFormStep" ADD CONSTRAINT "LeadCaptureFormStep_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadCaptureFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureField" ADD CONSTRAINT "LeadCaptureField_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadCaptureFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureField" ADD CONSTRAINT "LeadCaptureField_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "LeadCaptureFormStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureFieldOption" ADD CONSTRAINT "LeadCaptureFieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LeadCaptureField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureConsentBlock" ADD CONSTRAINT "LeadCaptureConsentBlock_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LeadCaptureFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "LeadCaptureFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmission" ADD CONSTRAINT "LeadCaptureSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmissionConsent" ADD CONSTRAINT "LeadCaptureSubmissionConsent_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LeadCaptureSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmissionValue" ADD CONSTRAINT "LeadCaptureSubmissionValue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LeadCaptureSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSubmissionValue" ADD CONSTRAINT "LeadCaptureSubmissionValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LeadCaptureField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureDestination" ADD CONSTRAINT "LeadCaptureDestination_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureRule" ADD CONSTRAINT "LeadCaptureRule_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureSpamAssessment" ADD CONSTRAINT "LeadCaptureSpamAssessment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "LeadCaptureSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureEmbedInstallation" ADD CONSTRAINT "LeadCaptureEmbedInstallation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadCaptureThankYouAction" ADD CONSTRAINT "LeadCaptureThankYouAction_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
