import type { RevenueSourceType, RevenueTransactionType } from "@prisma/client";

export type RevenueAdapterCustomer = {
  providerCustomerId: string;
  email?: string | null;
  displayName?: string | null;
  country?: string | null;
  signupAt?: Date | null;
  metadata?: Record<string, unknown>;
  internalUserId?: string | null;
  crmId?: string | null;
};

export type RevenueAdapterSubscription = {
  providerSubscriptionId: string;
  providerCustomerId: string;
  status: string;
  productId?: string | null;
  productName?: string | null;
  priceId?: string | null;
  planName?: string | null;
  mrrAmount?: number | null;
  currency: string;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export type RevenueAdapterTransaction = {
  providerTransactionId: string;
  providerCustomerId?: string | null;
  transactionType: RevenueTransactionType;
  originalAmount: number;
  netAmount: number;
  currency: string;
  occurredAt: Date;
  invoiceId?: string | null;
  paymentId?: string | null;
  subscriptionId?: string | null;
  isRefund?: boolean;
  isPartialRefund?: boolean;
  parentTransactionId?: string | null;
  lineItems?: RevenueAdapterLineItem[];
  metadata?: Record<string, unknown>;
};

export type RevenueAdapterLineItem = {
  providerLineItemId: string;
  description?: string | null;
  quantity?: number;
  unitAmount: number;
  totalAmount: number;
  currency: string;
  productId?: string | null;
  priceId?: string | null;
};

export type RevenueAdapterSyncResult = {
  customers: RevenueAdapterCustomer[];
  subscriptions: RevenueAdapterSubscription[];
  transactions: RevenueAdapterTransaction[];
};

export type RevenueAdapter = {
  sourceType: RevenueSourceType;
  isAvailable: () => boolean;
  sync: (input: { since?: Date; cursor?: string }) => Promise<RevenueAdapterSyncResult>;
};
