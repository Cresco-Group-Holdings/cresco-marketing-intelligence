import { FORMULA_DEFINITIONS } from "@/lib/revenue/constants";

export type RevenueTransactionInput = {
  originalAmount: number;
  netAmount: number;
  currency: string;
  occurredAt: Date;
  transactionType: string;
  isRefund: boolean;
  revenueCustomerId?: string | null;
  customerFirstPaymentAt?: Date | null;
};

export type SubscriptionInput = {
  mrrAmount: number;
  status: string;
  currency: string;
};

export type RevenueMetricsInput = {
  transactions: RevenueTransactionInput[];
  subscriptions: SubscriptionInput[];
  marketingSpend?: number;
  paidMarketingSpend?: number;
  newCustomers?: number;
  leads?: number;
  conversions?: number;
  trialStarts?: number;
  trialConversions?: number;
  ltvMethodology?: string | null;
  grossMarginPercent?: number | null;
};

export type RevenueMetricsResult = {
  totalRevenue: number;
  newRevenue: number;
  recurringRevenue: number;
  expansionRevenue: number;
  contractionRevenue: number;
  refunds: number;
  credits: number;
  netRevenue: number;
  mrr: number;
  arr: number;
  arpc: number;
  cac: number | null;
  blendedCac: number | null;
  paidCac: number | null;
  ltv: number | null;
  ltvCacRatio: number | null;
  paybackMonths: number | null;
  revenuePerLead: number | null;
  revenuePerConversion: number | null;
  trialToPaidRate: number | null;
  unattributedRevenue: number;
  formulaDefinitions: typeof FORMULA_DEFINITIONS;
  assumptions: string[];
};

const ACTIVE_STATUSES = new Set(["ACTIVE", "TRIALING"]);

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function calculateRevenueMetrics(input: RevenueMetricsInput): RevenueMetricsResult {
  const assumptions: string[] = [];
  let totalRevenue = 0;
  let newRevenue = 0;
  let recurringRevenue = 0;
  let refunds = 0;
  let credits = 0;
  let unattributedRevenue = 0;
  const payingCustomers = new Set<string>();

  for (const tx of input.transactions) {
    if (tx.isRefund || tx.transactionType === "REFUND") {
      refunds += Math.abs(tx.netAmount);
      continue;
    }
    if (tx.transactionType === "CREDIT") {
      credits += Math.abs(tx.netAmount);
      continue;
    }
    if (tx.transactionType === "PAYMENT" || tx.transactionType === "INVOICE") {
      totalRevenue += tx.originalAmount;
      if (!tx.revenueCustomerId) {
        unattributedRevenue += tx.originalAmount;
      } else {
        payingCustomers.add(tx.revenueCustomerId);
        if (tx.customerFirstPaymentAt && tx.occurredAt.getTime() === tx.customerFirstPaymentAt.getTime()) {
          newRevenue += tx.originalAmount;
        } else {
          recurringRevenue += tx.originalAmount;
        }
      }
    }
  }

  const netRevenue = totalRevenue - refunds - credits;
  const mrr = input.subscriptions
    .filter((s) => ACTIVE_STATUSES.has(s.status))
    .reduce((sum, s) => sum + s.mrrAmount, 0);
  const arr = mrr * 12;
  const arpc = payingCustomers.size > 0 ? round(netRevenue / payingCustomers.size) : 0;

  const newCustomers = input.newCustomers ?? 0;
  const cac = input.marketingSpend && newCustomers > 0 ? round(input.marketingSpend / newCustomers) : null;
  const blendedCac = input.marketingSpend && newCustomers > 0 ? round(input.marketingSpend / newCustomers) : null;
  const paidCac =
    input.paidMarketingSpend && newCustomers > 0 ? round(input.paidMarketingSpend / newCustomers) : null;

  let ltv: number | null = null;
  if (input.ltvMethodology === "SIMPLE_ARPC_X_12") {
    ltv = arpc > 0 ? round(arpc * 12) : null;
    assumptions.push("LTV calculated as ARPC × 12 (simple annualised methodology).");
  } else {
    assumptions.push("LTV not calculated — no explicit methodology configured.");
  }

  const ltvCacRatio = ltv && cac && cac > 0 ? round(ltv / cac, 2) : null;
  const paybackMonths =
    cac && arpc > 0 && input.grossMarginPercent
      ? round(cac / (arpc * (input.grossMarginPercent / 100)), 1)
      : null;

  const trialToPaidRate =
    input.trialStarts && input.trialStarts > 0 && input.trialConversions != null
      ? round((input.trialConversions / input.trialStarts) * 100, 2)
      : null;

  return {
    totalRevenue: round(totalRevenue),
    newRevenue: round(newRevenue),
    recurringRevenue: round(recurringRevenue),
    expansionRevenue: 0,
    contractionRevenue: 0,
    refunds: round(refunds),
    credits: round(credits),
    netRevenue: round(netRevenue),
    mrr: round(mrr),
    arr: round(arr),
    arpc,
    cac,
    blendedCac,
    paidCac,
    ltv,
    ltvCacRatio,
    paybackMonths,
    revenuePerLead: input.leads && input.leads > 0 ? round(netRevenue / input.leads) : null,
    revenuePerConversion:
      input.conversions && input.conversions > 0 ? round(netRevenue / input.conversions) : null,
    trialToPaidRate,
    unattributedRevenue: round(unattributedRevenue),
    formulaDefinitions: FORMULA_DEFINITIONS,
    assumptions,
  };
}
