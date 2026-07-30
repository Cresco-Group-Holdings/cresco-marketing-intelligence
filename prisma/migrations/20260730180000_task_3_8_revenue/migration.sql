-- Task 3.8: Revenue and unit economics intelligence

CREATE TYPE "RevenueSourceType" AS ENUM ('STRIPE', 'CRM', 'MANUAL_IMPORT', 'INTERNAL_EVENT');
CREATE TYPE "RevenueTransactionType" AS ENUM ('INVOICE', 'PAYMENT', 'REFUND', 'CREDIT', 'DISCOUNT', 'CHARGEBACK');
CREATE TYPE "RevenueSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'PAUSED', 'INCOMPLETE');
CREATE TYPE "RevenueCustomerLinkMethod" AS ENUM ('INTERNAL_CUSTOMER_ID', 'AUTHENTICATED_USER', 'STRIPE_METADATA', 'CRM_ID_CONFIRMED', 'SERVER_SIDE_ASSOCIATION');
CREATE TYPE "RevenueSyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');
CREATE TYPE "RevenueCohortDimension" AS ENUM ('SIGNUP_MONTH', 'ACQUISITION_CHANNEL', 'CAMPAIGN', 'FIRST_TOUCH', 'LAST_TOUCH', 'PRODUCT', 'PLAN', 'COUNTRY', 'CUSTOMER_TYPE');

CREATE TABLE "RevenueCustomer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceType" "RevenueSourceType" NOT NULL,
    "providerCustomerId" TEXT NOT NULL,
    "marketingIdentityId" TEXT,
    "email" TEXT,
    "displayName" TEXT,
    "country" TEXT,
    "customerType" TEXT,
    "signupAt" TIMESTAMP(3),
    "acquisitionChannel" TEXT,
    "firstTouchSource" TEXT,
    "lastTouchSource" TEXT,
    "campaign" TEXT,
    "originalCurrency" TEXT,
    "reportingCurrency" TEXT,
    "providerMetadata" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevenueCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueCustomerIdentityLink" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "revenueCustomerId" TEXT NOT NULL,
    "marketingIdentityId" TEXT NOT NULL,
    "linkMethod" "RevenueCustomerLinkMethod" NOT NULL,
    "evidence" JSONB,
    "confidence" DECIMAL(5,4),
    "confirmedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueCustomerIdentityLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueSubscription" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "revenueCustomerId" TEXT NOT NULL,
    "sourceType" "RevenueSourceType" NOT NULL,
    "providerSubscriptionId" TEXT NOT NULL,
    "status" "RevenueSubscriptionStatus" NOT NULL,
    "productId" TEXT,
    "productName" TEXT,
    "priceId" TEXT,
    "planName" TEXT,
    "mrrAmount" DECIMAL(24,6),
    "currency" TEXT NOT NULL,
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevenueSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueTransaction" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "revenueCustomerId" TEXT,
    "sourceType" "RevenueSourceType" NOT NULL,
    "transactionType" "RevenueTransactionType" NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "originalAmount" DECIMAL(24,6) NOT NULL,
    "netAmount" DECIMAL(24,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "reportingAmount" DECIMAL(24,6),
    "reportingCurrency" TEXT,
    "exchangeRate" DECIMAL(18,8),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "isRefund" BOOLEAN NOT NULL DEFAULT false,
    "isPartialRefund" BOOLEAN NOT NULL DEFAULT false,
    "parentTransactionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevenueTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueTransactionLineItem" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "revenueTransactionId" TEXT NOT NULL,
    "providerLineItemId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(24,6) NOT NULL,
    "totalAmount" DECIMAL(24,6) NOT NULL,
    "currency" TEXT NOT NULL,
    "productId" TEXT,
    "priceId" TEXT,
    "providerMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueTransactionLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueSyncRun" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sourceType" "RevenueSourceType" NOT NULL,
    "status" "RevenueSyncStatus" NOT NULL DEFAULT 'PENDING',
    "recordsSynced" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueCohortResult" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "dimension" "RevenueCohortDimension" NOT NULL,
    "cohortKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(24,6) NOT NULL,
    "mrr" DECIMAL(24,6),
    "currency" TEXT NOT NULL,
    "metadata" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueCohortResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RevenueUnitEconomicsSnapshot" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL,
    "reportingCurrency" TEXT,
    "totalRevenue" DECIMAL(24,6) NOT NULL,
    "newRevenue" DECIMAL(24,6) NOT NULL,
    "recurringRevenue" DECIMAL(24,6) NOT NULL,
    "expansionRevenue" DECIMAL(24,6) NOT NULL,
    "contractionRevenue" DECIMAL(24,6) NOT NULL,
    "refunds" DECIMAL(24,6) NOT NULL,
    "netRevenue" DECIMAL(24,6) NOT NULL,
    "mrr" DECIMAL(24,6) NOT NULL,
    "arr" DECIMAL(24,6) NOT NULL,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "arpc" DECIMAL(24,6),
    "cac" DECIMAL(24,6),
    "blendedCac" DECIMAL(24,6),
    "paidCac" DECIMAL(24,6),
    "ltv" DECIMAL(24,6),
    "ltvCacRatio" DECIMAL(12,4),
    "paybackMonths" DECIMAL(12,4),
    "revenuePerLead" DECIMAL(24,6),
    "revenuePerConversion" DECIMAL(24,6),
    "trialToPaidRate" DECIMAL(8,4),
    "unattributedRevenue" DECIMAL(24,6) NOT NULL,
    "formulaDefinitions" JSONB,
    "assumptions" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RevenueUnitEconomicsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RevenueCustomer_brandId_sourceType_providerCustomerId_key" ON "RevenueCustomer"("brandId", "sourceType", "providerCustomerId");
CREATE INDEX "RevenueCustomer_organisationId_brandId_idx" ON "RevenueCustomer"("organisationId", "brandId");
CREATE INDEX "RevenueCustomer_marketingIdentityId_idx" ON "RevenueCustomer"("marketingIdentityId");
CREATE INDEX "RevenueCustomer_isDeleted_idx" ON "RevenueCustomer"("isDeleted");

CREATE UNIQUE INDEX "RevenueCustomerIdentityLink_revenueCustomerId_marketingIdentityId_key" ON "RevenueCustomerIdentityLink"("revenueCustomerId", "marketingIdentityId");
CREATE INDEX "RevenueCustomerIdentityLink_organisationId_brandId_idx" ON "RevenueCustomerIdentityLink"("organisationId", "brandId");

CREATE UNIQUE INDEX "RevenueSubscription_brandId_sourceType_providerSubscriptionId_key" ON "RevenueSubscription"("brandId", "sourceType", "providerSubscriptionId");
CREATE INDEX "RevenueSubscription_organisationId_brandId_status_idx" ON "RevenueSubscription"("organisationId", "brandId", "status");
CREATE INDEX "RevenueSubscription_revenueCustomerId_idx" ON "RevenueSubscription"("revenueCustomerId");

CREATE UNIQUE INDEX "RevenueTransaction_brandId_sourceType_providerTransactionId_key" ON "RevenueTransaction"("brandId", "sourceType", "providerTransactionId");
CREATE UNIQUE INDEX "RevenueTransaction_idempotencyKey_key" ON "RevenueTransaction"("idempotencyKey");
CREATE INDEX "RevenueTransaction_organisationId_brandId_occurredAt_idx" ON "RevenueTransaction"("organisationId", "brandId", "occurredAt");
CREATE INDEX "RevenueTransaction_transactionType_idx" ON "RevenueTransaction"("transactionType");
CREATE INDEX "RevenueTransaction_revenueCustomerId_idx" ON "RevenueTransaction"("revenueCustomerId");

CREATE UNIQUE INDEX "RevenueTransactionLineItem_revenueTransactionId_providerLineItemId_key" ON "RevenueTransactionLineItem"("revenueTransactionId", "providerLineItemId");
CREATE INDEX "RevenueTransactionLineItem_organisationId_brandId_idx" ON "RevenueTransactionLineItem"("organisationId", "brandId");

CREATE UNIQUE INDEX "RevenueSyncRun_idempotencyKey_key" ON "RevenueSyncRun"("idempotencyKey");
CREATE INDEX "RevenueSyncRun_organisationId_brandId_createdAt_idx" ON "RevenueSyncRun"("organisationId", "brandId", "createdAt");
CREATE INDEX "RevenueSyncRun_sourceType_status_idx" ON "RevenueSyncRun"("sourceType", "status");

CREATE INDEX "RevenueCohortResult_organisationId_brandId_dimension_cohortKey_idx" ON "RevenueCohortResult"("organisationId", "brandId", "dimension", "cohortKey");
CREATE INDEX "RevenueCohortResult_calculatedAt_idx" ON "RevenueCohortResult"("calculatedAt");

CREATE INDEX "RevenueUnitEconomicsSnapshot_organisationId_brandId_calculatedAt_idx" ON "RevenueUnitEconomicsSnapshot"("organisationId", "brandId", "calculatedAt");

ALTER TABLE "RevenueCustomer" ADD CONSTRAINT "RevenueCustomer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomer" ADD CONSTRAINT "RevenueCustomer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomer" ADD CONSTRAINT "RevenueCustomer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomer" ADD CONSTRAINT "RevenueCustomer_marketingIdentityId_fkey" FOREIGN KEY ("marketingIdentityId") REFERENCES "MarketingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RevenueCustomerIdentityLink" ADD CONSTRAINT "RevenueCustomerIdentityLink_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomerIdentityLink" ADD CONSTRAINT "RevenueCustomerIdentityLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomerIdentityLink" ADD CONSTRAINT "RevenueCustomerIdentityLink_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomerIdentityLink" ADD CONSTRAINT "RevenueCustomerIdentityLink_revenueCustomerId_fkey" FOREIGN KEY ("revenueCustomerId") REFERENCES "RevenueCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCustomerIdentityLink" ADD CONSTRAINT "RevenueCustomerIdentityLink_marketingIdentityId_fkey" FOREIGN KEY ("marketingIdentityId") REFERENCES "MarketingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueSubscription" ADD CONSTRAINT "RevenueSubscription_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueSubscription" ADD CONSTRAINT "RevenueSubscription_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueSubscription" ADD CONSTRAINT "RevenueSubscription_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueSubscription" ADD CONSTRAINT "RevenueSubscription_revenueCustomerId_fkey" FOREIGN KEY ("revenueCustomerId") REFERENCES "RevenueCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_revenueCustomerId_fkey" FOREIGN KEY ("revenueCustomerId") REFERENCES "RevenueCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_parentTransactionId_fkey" FOREIGN KEY ("parentTransactionId") REFERENCES "RevenueTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RevenueTransactionLineItem" ADD CONSTRAINT "RevenueTransactionLineItem_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransactionLineItem" ADD CONSTRAINT "RevenueTransactionLineItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransactionLineItem" ADD CONSTRAINT "RevenueTransactionLineItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueTransactionLineItem" ADD CONSTRAINT "RevenueTransactionLineItem_revenueTransactionId_fkey" FOREIGN KEY ("revenueTransactionId") REFERENCES "RevenueTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueSyncRun" ADD CONSTRAINT "RevenueSyncRun_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueSyncRun" ADD CONSTRAINT "RevenueSyncRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueSyncRun" ADD CONSTRAINT "RevenueSyncRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueCohortResult" ADD CONSTRAINT "RevenueCohortResult_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCohortResult" ADD CONSTRAINT "RevenueCohortResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueCohortResult" ADD CONSTRAINT "RevenueCohortResult_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RevenueUnitEconomicsSnapshot" ADD CONSTRAINT "RevenueUnitEconomicsSnapshot_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueUnitEconomicsSnapshot" ADD CONSTRAINT "RevenueUnitEconomicsSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RevenueUnitEconomicsSnapshot" ADD CONSTRAINT "RevenueUnitEconomicsSnapshot_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
