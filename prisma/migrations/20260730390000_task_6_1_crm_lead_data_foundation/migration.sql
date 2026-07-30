-- Task 6.1: CRM and Lead Data Foundation

-- CreateEnum
CREATE TYPE "CrmLeadStatus" AS ENUM ('NEW', 'OPEN', 'CONTACTED', 'RESPONDED', 'QUALIFYING', 'QUALIFIED', 'UNQUALIFIED', 'NURTURING', 'OPPORTUNITY_CREATED', 'CUSTOMER', 'LOST', 'SUPPRESSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CrmLifecycleStage" AS ENUM ('VISITOR', 'LEAD', 'MARKETING_QUALIFIED', 'SALES_QUALIFIED', 'OPPORTUNITY', 'TRIAL', 'CUSTOMER', 'ACTIVE_CUSTOMER', 'FORMER_CUSTOMER', 'PARTNER');

-- CreateEnum
CREATE TYPE "CrmQualificationState" AS ENUM ('UNASSESSED', 'IN_PROGRESS', 'QUALIFIED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "CrmLeadSourceType" AS ENUM ('WEBSITE_FORM', 'WEBSITE_EVENT', 'SOCIAL_INBOX', 'SOCIAL_LEAD_FORM', 'ADVERTISING_LEAD_FORM', 'MANUAL_ENTRY', 'CSV_IMPORT', 'API', 'REFERRAL', 'EVENT', 'EMAIL_REPLY', 'CHAT', 'PARTNER', 'PRODUCT_SIGNUP', 'DEMO_REQUEST', 'GRANT_INTEREST', 'CAPITAL_ANALYSIS_INTEREST', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmContactMethodType" AS ENUM ('EMAIL', 'PHONE', 'MOBILE', 'LINKEDIN', 'WHATSAPP', 'TELEGRAM', 'WEBSITE', 'OTHER');

-- CreateEnum
CREATE TYPE "CrmContactVerificationState" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'INVALID');

-- CreateEnum
CREATE TYPE "CrmDuplicateCandidateStatus" AS ENUM ('PENDING', 'CONFIRMED', 'NOT_DUPLICATE', 'MERGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CrmMergeOperationStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "CrmCustomFieldType" AS ENUM ('TEXT', 'LONG_TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'DATETIME', 'SINGLE_SELECT', 'MULTI_SELECT', 'URL', 'EMAIL', 'PHONE', 'CURRENCY');

-- CreateEnum
CREATE TYPE "CrmIdentityLinkType" AS ENUM ('AUTH_USER', 'VERIFIED_EMAIL', 'CONFIRMED_PHONE', 'CRM_EXTERNAL_ID', 'STRIPE_CUSTOMER', 'SOCIAL_LEAD', 'MARKETING_IDENTITY', 'MARKETING_LEAD', 'STAFF_CONFIRMED');

-- CreateEnum
CREATE TYPE "CrmActivityTimelineType" AS ENUM ('LEAD_CREATED', 'FORM_SUBMISSION', 'WEBSITE_CONVERSION', 'SOCIAL_MESSAGE', 'EMAIL', 'CALL', 'MEETING', 'NOTE', 'TASK', 'CAMPAIGN_INTERACTION', 'ADVERTISEMENT_INTERACTION', 'LIFECYCLE_CHANGE', 'STATUS_CHANGE', 'PIPELINE_MOVEMENT', 'TRIAL_START', 'SUBSCRIPTION', 'PAYMENT', 'REFUND', 'CONSENT_CHANGE');

-- CreateEnum
CREATE TYPE "CrmCompanyRelationshipStatus" AS ENUM ('PROSPECT', 'CUSTOMER', 'PARTNER', 'VENDOR', 'OTHER');

-- CreateTable
CREATE TABLE "CrmPerson" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "displayName" TEXT,
    "preferredLanguage" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "authUserId" TEXT,
    "marketingIdentityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "personId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "department" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCompany" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "legalName" TEXT,
    "tradingName" TEXT,
    "website" TEXT,
    "country" TEXT,
    "industry" TEXT,
    "employeeSizeBand" TEXT,
    "revenueBand" TEXT,
    "companyRegistrationRef" TEXT,
    "companyType" TEXT,
    "relationshipStatus" "CrmCompanyRelationshipStatus" NOT NULL DEFAULT 'PROSPECT',
    "ownerUserId" TEXT,
    "parentCompanyId" TEXT,
    "enrichmentProvider" TEXT,
    "enrichmentRetrievedAt" TIMESTAMP(3),
    "enrichmentReference" TEXT,
    "enrichmentConfidence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCompanyDomain" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmCompanyDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadSource" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceType" "CrmLeadSourceType" NOT NULL,
    "originalSourceType" "CrmLeadSourceType" NOT NULL,
    "latestSourceType" "CrmLeadSourceType",
    "provider" TEXT,
    "formName" TEXT,
    "landingPage" TEXT,
    "firstTouchCampaign" TEXT,
    "lastTouchCampaign" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmTerm" TEXT,
    "utmContent" TEXT,
    "attributionJourneyId" TEXT,
    "sourceEvidence" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLead" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "personId" TEXT,
    "companyId" TEXT,
    "sourceId" TEXT,
    "ownerUserId" TEXT,
    "status" "CrmLeadStatus" NOT NULL DEFAULT 'NEW',
    "lifecycleStage" "CrmLifecycleStage" NOT NULL DEFAULT 'LEAD',
    "qualificationState" "CrmQualificationState" NOT NULL DEFAULT 'UNASSESSED',
    "primaryProductInterest" TEXT,
    "preferredLanguage" TEXT,
    "country" TEXT,
    "timezone" TEXT,
    "marketingLeadId" TEXT,
    "firstSeenAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "CrmLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadProductInterest" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadProductInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadLifecycleHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "previousStage" "CrmLifecycleStage",
    "newStage" "CrmLifecycleStage" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadLifecycleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadStatusHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "previousStatus" "CrmLeadStatus",
    "newStatus" "CrmLeadStatus" NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadTag" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmLeadTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmLeadTagLink" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CrmLeadTagLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmContactMethod" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "methodType" "CrmContactMethodType" NOT NULL,
    "normalisedValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "verificationState" "CrmContactVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "consentEligible" BOOLEAN NOT NULL DEFAULT true,
    "lastVerifiedAt" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContactMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmAddress" (
    "id" TEXT NOT NULL,
    "personId" TEXT,
    "companyId" TEXT,
    "label" TEXT,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmExternalReference" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "personId" TEXT,
    "companyId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmIdentityLink" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "linkType" "CrmIdentityLinkType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "evidence" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmIdentityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmDuplicateCandidate" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "sourceRecordType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "targetRecordType" TEXT NOT NULL,
    "targetRecordId" TEXT NOT NULL,
    "matchEvidence" JSONB NOT NULL,
    "status" "CrmDuplicateCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmDuplicateCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmMergeOperation" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceRecordType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "destinationRecordType" TEXT NOT NULL,
    "destinationRecordId" TEXT NOT NULL,
    "fieldConflicts" JSONB,
    "status" "CrmMergeOperationStatus" NOT NULL DEFAULT 'PENDING',
    "consentPreserved" BOOLEAN NOT NULL DEFAULT true,
    "attributionPreserved" BOOLEAN NOT NULL DEFAULT true,
    "rollbackStrategy" TEXT,
    "operatorUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmMergeOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "entityType" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CrmCustomFieldType" NOT NULL,
    "options" JSONB,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT NOT NULL DEFAULT 'STANDARD',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmCustomFieldValue" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "leadId" TEXT,
    "personId" TEXT,
    "companyId" TEXT,
    "valueText" TEXT,
    "valueNumber" DECIMAL(24,6),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmActivityTimelineItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "brandId" TEXT,
    "leadId" TEXT,
    "personId" TEXT,
    "companyId" TEXT,
    "itemType" "CrmActivityTimelineType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'STANDARD',
    "sourceSystem" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmActivityTimelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmSavedView" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "isTeamView" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmSavedView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmImportJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "entityType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "fieldMapping" JSONB,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedRows" INTEGER NOT NULL DEFAULT 0,
    "rejectedDetails" JSONB,
    "idempotencyKey" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmExportJob" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT,
    "brandId" TEXT,
    "entityType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "filters" JSONB,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CrmContact_personId_key" ON "CrmContact"("personId");

-- CreateIndex
CREATE INDEX "CrmPerson_organisationId_brandId_idx" ON "CrmPerson"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "CrmPerson_authUserId_idx" ON "CrmPerson"("authUserId");

-- CreateIndex
CREATE INDEX "CrmContact_organisationId_brandId_idx" ON "CrmContact"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "CrmCompany_organisationId_brandId_idx" ON "CrmCompany"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "CrmCompany_tradingName_idx" ON "CrmCompany"("tradingName");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCompanyDomain_companyId_domain_key" ON "CrmCompanyDomain"("companyId", "domain");

-- CreateIndex
CREATE INDEX "CrmCompanyDomain_domain_idx" ON "CrmCompanyDomain"("domain");

-- CreateIndex
CREATE INDEX "CrmLeadSource_organisationId_brandId_sourceType_idx" ON "CrmLeadSource"("organisationId", "brandId", "sourceType");

-- CreateIndex
CREATE INDEX "CrmLead_organisationId_brandId_status_idx" ON "CrmLead"("organisationId", "brandId", "status");

-- CreateIndex
CREATE INDEX "CrmLead_ownerUserId_idx" ON "CrmLead"("ownerUserId");

-- CreateIndex
CREATE INDEX "CrmLead_lifecycleStage_idx" ON "CrmLead"("lifecycleStage");

-- CreateIndex
CREATE INDEX "CrmLead_marketingLeadId_idx" ON "CrmLead"("marketingLeadId");

-- CreateIndex
CREATE INDEX "CrmLeadProductInterest_leadId_idx" ON "CrmLeadProductInterest"("leadId");

-- CreateIndex
CREATE INDEX "CrmLeadAssignment_leadId_idx" ON "CrmLeadAssignment"("leadId");

-- CreateIndex
CREATE INDEX "CrmLeadLifecycleHistory_leadId_createdAt_idx" ON "CrmLeadLifecycleHistory"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "CrmLeadStatusHistory_leadId_createdAt_idx" ON "CrmLeadStatusHistory"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CrmLeadTag_organisationId_name_key" ON "CrmLeadTag"("organisationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CrmLeadTagLink_leadId_tagId_key" ON "CrmLeadTagLink"("leadId", "tagId");

-- CreateIndex
CREATE INDEX "CrmContactMethod_personId_methodType_idx" ON "CrmContactMethod"("personId", "methodType");

-- CreateIndex
CREATE INDEX "CrmContactMethod_normalisedValue_idx" ON "CrmContactMethod"("normalisedValue");

-- CreateIndex
CREATE INDEX "CrmAddress_personId_idx" ON "CrmAddress"("personId");

-- CreateIndex
CREATE INDEX "CrmAddress_companyId_idx" ON "CrmAddress"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmExternalReference_provider_externalId_leadId_key" ON "CrmExternalReference"("provider", "externalId", "leadId");

-- CreateIndex
CREATE INDEX "CrmExternalReference_externalId_idx" ON "CrmExternalReference"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "CrmIdentityLink_personId_linkType_externalId_key" ON "CrmIdentityLink"("personId", "linkType", "externalId");

-- CreateIndex
CREATE INDEX "CrmIdentityLink_linkType_externalId_idx" ON "CrmIdentityLink"("linkType", "externalId");

-- CreateIndex
CREATE INDEX "CrmDuplicateCandidate_organisationId_status_idx" ON "CrmDuplicateCandidate"("organisationId", "status");

-- CreateIndex
CREATE INDEX "CrmDuplicateCandidate_sourceRecordId_targetRecordId_idx" ON "CrmDuplicateCandidate"("sourceRecordId", "targetRecordId");

-- CreateIndex
CREATE INDEX "CrmMergeOperation_organisationId_status_idx" ON "CrmMergeOperation"("organisationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CrmCustomFieldDefinition_organisationId_entityType_fieldKey_key" ON "CrmCustomFieldDefinition"("organisationId", "entityType", "fieldKey");

-- CreateIndex
CREATE INDEX "CrmCustomFieldDefinition_entityType_idx" ON "CrmCustomFieldDefinition"("entityType");

-- CreateIndex
CREATE INDEX "CrmCustomFieldValue_definitionId_leadId_idx" ON "CrmCustomFieldValue"("definitionId", "leadId");

-- CreateIndex
CREATE INDEX "CrmActivityTimelineItem_leadId_occurredAt_idx" ON "CrmActivityTimelineItem"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "CrmActivityTimelineItem_organisationId_brandId_idx" ON "CrmActivityTimelineItem"("organisationId", "brandId");

-- CreateIndex
CREATE INDEX "CrmSavedView_organisationId_entityType_idx" ON "CrmSavedView"("organisationId", "entityType");

-- CreateIndex
CREATE INDEX "CrmImportJob_organisationId_status_idx" ON "CrmImportJob"("organisationId", "status");

-- CreateIndex
CREATE INDEX "CrmExportJob_organisationId_createdAt_idx" ON "CrmExportJob"("organisationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CrmPerson" ADD CONSTRAINT "CrmPerson_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPerson" ADD CONSTRAINT "CrmPerson_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmPerson" ADD CONSTRAINT "CrmPerson_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompany" ADD CONSTRAINT "CrmCompany_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompany" ADD CONSTRAINT "CrmCompany_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompany" ADD CONSTRAINT "CrmCompany_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompany" ADD CONSTRAINT "CrmCompany_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompany" ADD CONSTRAINT "CrmCompany_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "CrmCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCompanyDomain" ADD CONSTRAINT "CrmCompanyDomain_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadSource" ADD CONSTRAINT "CrmLeadSource_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadSource" ADD CONSTRAINT "CrmLeadSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadSource" ADD CONSTRAINT "CrmLeadSource_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CrmLeadSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLead" ADD CONSTRAINT "CrmLead_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadProductInterest" ADD CONSTRAINT "CrmLeadProductInterest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadAssignment" ADD CONSTRAINT "CrmLeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadAssignment" ADD CONSTRAINT "CrmLeadAssignment_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadAssignment" ADD CONSTRAINT "CrmLeadAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadLifecycleHistory" ADD CONSTRAINT "CrmLeadLifecycleHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadLifecycleHistory" ADD CONSTRAINT "CrmLeadLifecycleHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadStatusHistory" ADD CONSTRAINT "CrmLeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadStatusHistory" ADD CONSTRAINT "CrmLeadStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadTagLink" ADD CONSTRAINT "CrmLeadTagLink_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmLeadTagLink" ADD CONSTRAINT "CrmLeadTagLink_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "CrmLeadTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmContactMethod" ADD CONSTRAINT "CrmContactMethod_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAddress" ADD CONSTRAINT "CrmAddress_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmAddress" ADD CONSTRAINT "CrmAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "CrmCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmExternalReference" ADD CONSTRAINT "CrmExternalReference_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIdentityLink" ADD CONSTRAINT "CrmIdentityLink_personId_fkey" FOREIGN KEY ("personId") REFERENCES "CrmPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIdentityLink" ADD CONSTRAINT "CrmIdentityLink_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmDuplicateCandidate" ADD CONSTRAINT "CrmDuplicateCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmMergeOperation" ADD CONSTRAINT "CrmMergeOperation_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomFieldDefinition" ADD CONSTRAINT "CrmCustomFieldDefinition_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomFieldDefinition" ADD CONSTRAINT "CrmCustomFieldDefinition_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomFieldDefinition" ADD CONSTRAINT "CrmCustomFieldDefinition_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomFieldValue" ADD CONSTRAINT "CrmCustomFieldValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "CrmCustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmCustomFieldValue" ADD CONSTRAINT "CrmCustomFieldValue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivityTimelineItem" ADD CONSTRAINT "CrmActivityTimelineItem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmActivityTimelineItem" ADD CONSTRAINT "CrmActivityTimelineItem_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSavedView" ADD CONSTRAINT "CrmSavedView_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSavedView" ADD CONSTRAINT "CrmSavedView_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSavedView" ADD CONSTRAINT "CrmSavedView_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmSavedView" ADD CONSTRAINT "CrmSavedView_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportJob" ADD CONSTRAINT "CrmImportJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportJob" ADD CONSTRAINT "CrmImportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportJob" ADD CONSTRAINT "CrmImportJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmImportJob" ADD CONSTRAINT "CrmImportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmExportJob" ADD CONSTRAINT "CrmExportJob_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmExportJob" ADD CONSTRAINT "CrmExportJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmExportJob" ADD CONSTRAINT "CrmExportJob_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmExportJob" ADD CONSTRAINT "CrmExportJob_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
