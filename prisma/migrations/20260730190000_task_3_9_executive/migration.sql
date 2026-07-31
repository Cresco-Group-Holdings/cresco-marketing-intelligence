-- Task 3.9: Executive marketing intelligence dashboard

CREATE TYPE "ExecutiveComparisonType" AS ENUM (
  'PREVIOUS_PERIOD',
  'PREVIOUS_MONTH',
  'PREVIOUS_QUARTER',
  'CUSTOM',
  'PROJECT',
  'BRAND'
);

CREATE TABLE "ExecutiveDashboardPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "projectId" TEXT,
  "brandId" TEXT,
  "dateRangeDays" INTEGER NOT NULL DEFAULT 28,
  "comparisonType" "ExecutiveComparisonType" NOT NULL DEFAULT 'PREVIOUS_PERIOD',
  "comparisonFrom" TIMESTAMP(3),
  "comparisonTo" TIMESTAMP(3),
  "reportingCurrency" TEXT NOT NULL DEFAULT 'USD',
  "filters" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExecutiveDashboardPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExecutiveDashboardPreference_userId_organisationId_key"
  ON "ExecutiveDashboardPreference"("userId", "organisationId");

CREATE INDEX "ExecutiveDashboardPreference_organisationId_idx"
  ON "ExecutiveDashboardPreference"("organisationId");

ALTER TABLE "ExecutiveDashboardPreference"
  ADD CONSTRAINT "ExecutiveDashboardPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExecutiveDashboardPreference"
  ADD CONSTRAINT "ExecutiveDashboardPreference_organisationId_fkey"
  FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
