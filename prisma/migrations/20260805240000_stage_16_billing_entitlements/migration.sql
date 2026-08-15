-- Stage 16: Billing, plans, usage and entitlements

CREATE TYPE "BillingAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'UNPAID', 'PAUSED', 'INCOMPLETE');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "UsageAllowancePeriod" AS ENUM ('DAILY', 'MONTHLY', 'BILLING_PERIOD', 'LIFETIME');
CREATE TYPE "EntitlementValueType" AS ENUM ('BOOLEAN', 'COUNT', 'RATE');
CREATE TYPE "WorkspaceEntitlementSource" AS ENUM ('PLAN', 'OVERRIDE', 'PROMO', 'TRIAL');
CREATE TYPE "BillingEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'DUPLICATE');
CREATE TYPE "TrialStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "BillingAccount" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "status" "BillingAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingEmail" TEXT,
  "taxMetadata" JSONB,
  "externalCustomerRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingAccount_organisationId_key" ON "BillingAccount"("organisationId");
CREATE INDEX "BillingAccount_workspaceId_idx" ON "BillingAccount"("workspaceId");
CREATE INDEX "BillingAccount_status_idx" ON "BillingAccount"("status");
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlan_key_key" ON "SubscriptionPlan"("key");

CREATE TABLE "SubscriptionPlanVersion" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
  "annualPriceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "externalPriceMonthlyRef" TEXT,
  "externalPriceAnnualRef" TEXT,
  "trialDays" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlanVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPlanVersion_planId_version_key" ON "SubscriptionPlanVersion"("planId", "version");
CREATE INDEX "SubscriptionPlanVersion_planId_isCurrent_idx" ON "SubscriptionPlanVersion"("planId", "isCurrent");
ALTER TABLE "SubscriptionPlanVersion" ADD CONSTRAINT "SubscriptionPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "planVersionId" TEXT NOT NULL,
  "entitlementKey" TEXT NOT NULL,
  "valueType" "EntitlementValueType" NOT NULL DEFAULT 'COUNT',
  "limitValue" INTEGER,
  "booleanValue" BOOLEAN,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PlanEntitlement_planVersionId_entitlementKey_key" ON "PlanEntitlement"("planVersionId", "entitlementKey");
CREATE INDEX "PlanEntitlement_entitlementKey_idx" ON "PlanEntitlement"("entitlementKey");
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "billingAccountId" TEXT NOT NULL,
  "planVersionId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
  "externalSubscriptionRef" TEXT,
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "cancelledAt" TIMESTAMP(3),
  "trialEnd" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Subscription_billingAccountId_key" ON "Subscription"("billingAccountId");
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");
CREATE INDEX "Subscription_planVersionId_idx" ON "Subscription"("planVersionId");
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "WorkspaceEntitlement" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "entitlementKey" TEXT NOT NULL,
  "valueType" "EntitlementValueType" NOT NULL DEFAULT 'COUNT',
  "limitValue" INTEGER,
  "booleanValue" BOOLEAN,
  "source" "WorkspaceEntitlementSource" NOT NULL DEFAULT 'PLAN',
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkspaceEntitlement_organisationId_entitlementKey_source_key" ON "WorkspaceEntitlement"("organisationId", "entitlementKey", "source");
CREATE INDEX "WorkspaceEntitlement_workspaceId_idx" ON "WorkspaceEntitlement"("workspaceId");
CREATE INDEX "WorkspaceEntitlement_entitlementKey_idx" ON "WorkspaceEntitlement"("entitlementKey");
ALTER TABLE "WorkspaceEntitlement" ADD CONSTRAINT "WorkspaceEntitlement_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UsageMeter" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageMeter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UsageMeter_key_key" ON "UsageMeter"("key");

CREATE TABLE "UsageAllowance" (
  "id" TEXT NOT NULL,
  "planVersionId" TEXT NOT NULL,
  "meterKey" TEXT NOT NULL,
  "allowance" INTEGER NOT NULL,
  "period" "UsageAllowancePeriod" NOT NULL DEFAULT 'BILLING_PERIOD',
  "overageAllowed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageAllowance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UsageAllowance_planVersionId_meterKey_period_key" ON "UsageAllowance"("planVersionId", "meterKey", "period");
ALTER TABLE "UsageAllowance" ADD CONSTRAINT "UsageAllowance_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageAllowance" ADD CONSTRAINT "UsageAllowance_meterKey_fkey" FOREIGN KEY ("meterKey") REFERENCES "UsageMeter"("key") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UsageRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organisationId" TEXT NOT NULL,
  "meterKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UsageRecord_organisationId_idempotencyKey_key" ON "UsageRecord"("organisationId", "idempotencyKey");
CREATE INDEX "UsageRecord_organisationId_meterKey_periodStart_idx" ON "UsageRecord"("organisationId", "meterKey", "periodStart");
CREATE INDEX "UsageRecord_workspaceId_recordedAt_idx" ON "UsageRecord"("workspaceId", "recordedAt");
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_meterKey_fkey" FOREIGN KEY ("meterKey") REFERENCES "UsageMeter"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "BillingInvoiceReference" (
  "id" TEXT NOT NULL,
  "billingAccountId" TEXT NOT NULL,
  "externalInvoiceRef" TEXT NOT NULL,
  "invoiceUrl" TEXT,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingInvoiceReference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingInvoiceReference_externalInvoiceRef_key" ON "BillingInvoiceReference"("externalInvoiceRef");
CREATE INDEX "BillingInvoiceReference_billingAccountId_createdAt_idx" ON "BillingInvoiceReference"("billingAccountId", "createdAt");
ALTER TABLE "BillingInvoiceReference" ADD CONSTRAINT "BillingInvoiceReference_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "BillingEvent" (
  "id" TEXT NOT NULL,
  "billingAccountId" TEXT,
  "externalEventRef" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "status" "BillingEventStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "errorMessage" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BillingEvent_externalEventRef_key" ON "BillingEvent"("externalEventRef");
CREATE INDEX "BillingEvent_billingAccountId_createdAt_idx" ON "BillingEvent"("billingAccountId", "createdAt");
CREATE INDEX "BillingEvent_status_idx" ON "BillingEvent"("status");
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Trial" (
  "id" TEXT NOT NULL,
  "billingAccountId" TEXT NOT NULL,
  "status" "TrialStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Trial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Trial_billingAccountId_key" ON "Trial"("billingAccountId");
CREATE INDEX "Trial_status_endsAt_idx" ON "Trial"("status", "endsAt");
ALTER TABLE "Trial" ADD CONSTRAINT "Trial_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PromoCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "planVersionId" TEXT,
  "discountPercent" INTEGER,
  "trialDaysExtra" INTEGER,
  "maxRedemptions" INTEGER,
  "redemptionCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_isActive_expiresAt_idx" ON "PromoCode"("isActive", "expiresAt");
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "SubscriptionPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
