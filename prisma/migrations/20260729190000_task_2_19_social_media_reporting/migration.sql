-- Task 2.19: Social media reporting

CREATE TYPE "SocialReportType" AS ENUM (
  'WEEKLY_PERFORMANCE',
  'MONTHLY_PERFORMANCE',
  'CAMPAIGN_REPORT',
  'CHANNEL_REPORT',
  'CONTENT_REPORT',
  'EXECUTIVE_SUMMARY',
  'CLIENT_REPORT'
);

CREATE TYPE "SocialReportStatus" AS ENUM ('DRAFT', 'GENERATING', 'READY', 'FAILED', 'ARCHIVED');
CREATE TYPE "SocialReportSectionType" AS ENUM (
  'OVERVIEW',
  'PUBLISHING',
  'REACH_IMPRESSIONS',
  'ENGAGEMENT',
  'VIDEO_PERFORMANCE',
  'FOLLOWER_GROWTH',
  'TOP_CONTENT',
  'WEAK_CONTENT',
  'LEADS',
  'CAMPAIGN_OUTCOMES',
  'RECOMMENDATIONS',
  'DATA_LIMITATIONS',
  'CUSTOM_NOTES',
  'AI_NARRATIVE'
);
CREATE TYPE "SocialReportExportFormat" AS ENUM ('PDF', 'CSV', 'JSON');
CREATE TYPE "SocialReportExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
CREATE TYPE "SocialReportScheduleCadence" AS ENUM ('WEEKLY', 'MONTHLY', 'CAMPAIGN_END');
CREATE TYPE "SocialReportShareStatus" AS ENUM ('DISABLED', 'ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "SocialReport" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "reportType" "SocialReportType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "SocialReportStatus" NOT NULL DEFAULT 'DRAFT',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enabledSections" "SocialReportSectionType"[] DEFAULT ARRAY[]::"SocialReportSectionType"[],
  "selectedMetrics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "customNotes" TEXT,
  "includeRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "includeCrescoBranding" BOOLEAN NOT NULL DEFAULT true,
  "narrative" JSONB,
  "narrativeSource" TEXT,
  "aiRequestId" TEXT,
  "dataLimitations" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "shareToken" TEXT,
  "shareStatus" "SocialReportShareStatus" NOT NULL DEFAULT 'DISABLED',
  "shareExpiresAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "SocialReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReportSection" (
  "id" TEXT NOT NULL,
  "socialReportId" TEXT NOT NULL,
  "sectionType" "SocialReportSectionType" NOT NULL,
  "title" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "content" JSONB NOT NULL,
  "notes" TEXT,
  CONSTRAINT "SocialReportSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReportSnapshot" (
  "id" TEXT NOT NULL,
  "socialReportId" TEXT NOT NULL,
  "snapshotData" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialReportSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReportSchedule" (
  "id" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "brandId" TEXT NOT NULL,
  "reportType" "SocialReportType" NOT NULL,
  "cadence" "SocialReportScheduleCadence" NOT NULL,
  "timezone" TEXT NOT NULL,
  "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "enabledSections" "SocialReportSectionType"[] DEFAULT ARRAY[]::"SocialReportSectionType"[],
  "includeRecommendations" BOOLEAN NOT NULL DEFAULT true,
  "includeCrescoBranding" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "nextRunAt" TIMESTAMP(3),
  "lastRunAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialReportSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReportRecipient" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT,
  "reportId" TEXT,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "SocialReportRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialReportExport" (
  "id" TEXT NOT NULL,
  "socialReportId" TEXT NOT NULL,
  "format" "SocialReportExportFormat" NOT NULL,
  "status" "SocialReportExportStatus" NOT NULL DEFAULT 'PENDING',
  "fileName" TEXT,
  "mimeType" TEXT,
  "rowCount" INT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "SocialReportExport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialReport_shareToken_key" ON "SocialReport"("shareToken");
CREATE INDEX "SocialReport_organisationId_brandId_status_idx" ON "SocialReport"("organisationId", "brandId", "status");
CREATE INDEX "SocialReport_createdByUserId_idx" ON "SocialReport"("createdByUserId");
CREATE INDEX "SocialReport_periodStart_periodEnd_idx" ON "SocialReport"("periodStart", "periodEnd");
CREATE INDEX "SocialReport_shareToken_idx" ON "SocialReport"("shareToken");

CREATE UNIQUE INDEX "SocialReportSection_socialReportId_sectionType_key" ON "SocialReportSection"("socialReportId", "sectionType");
CREATE INDEX "SocialReportSection_socialReportId_sortOrder_idx" ON "SocialReportSection"("socialReportId", "sortOrder");

CREATE INDEX "SocialReportSnapshot_socialReportId_generatedAt_idx" ON "SocialReportSnapshot"("socialReportId", "generatedAt");

CREATE INDEX "SocialReportSchedule_organisationId_brandId_isActive_idx" ON "SocialReportSchedule"("organisationId", "brandId", "isActive");
CREATE INDEX "SocialReportSchedule_nextRunAt_idx" ON "SocialReportSchedule"("nextRunAt");

CREATE INDEX "SocialReportRecipient_scheduleId_idx" ON "SocialReportRecipient"("scheduleId");
CREATE INDEX "SocialReportRecipient_reportId_idx" ON "SocialReportRecipient"("reportId");
CREATE INDEX "SocialReportRecipient_email_idx" ON "SocialReportRecipient"("email");

CREATE INDEX "SocialReportExport_socialReportId_createdAt_idx" ON "SocialReportExport"("socialReportId", "createdAt");

ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReport" ADD CONSTRAINT "SocialReport_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialReportSection" ADD CONSTRAINT "SocialReportSection_socialReportId_fkey" FOREIGN KEY ("socialReportId") REFERENCES "SocialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialReportSnapshot" ADD CONSTRAINT "SocialReportSnapshot_socialReportId_fkey" FOREIGN KEY ("socialReportId") REFERENCES "SocialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocialReportSchedule" ADD CONSTRAINT "SocialReportSchedule_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReportSchedule" ADD CONSTRAINT "SocialReportSchedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReportSchedule" ADD CONSTRAINT "SocialReportSchedule_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReportSchedule" ADD CONSTRAINT "SocialReportSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "UserProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocialReportRecipient" ADD CONSTRAINT "SocialReportRecipient_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "SocialReportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReportRecipient" ADD CONSTRAINT "SocialReportRecipient_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SocialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialReportRecipient" ADD CONSTRAINT "SocialReportRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocialReportExport" ADD CONSTRAINT "SocialReportExport_socialReportId_fkey" FOREIGN KEY ("socialReportId") REFERENCES "SocialReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
