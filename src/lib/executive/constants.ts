import type { ExecutiveSection } from "@/lib/executive/types";

export const EXECUTIVE_DISCLAIMER =
  "Executive metrics are sourced from synchronised platform data. Unavailable metrics are shown explicitly — never as zero.";

export const EXECUTIVE_FORMULA_DEFINITIONS: Record<string, string> = {
  visitors: "Sum of sessions from GA4 or first-party tracking observations in the selected period.",
  leads: "Count of marketing leads created in the selected period (excluding deleted).",
  qualifiedLeads: "Leads with status in qualified set (QUALIFIED, CONVERTED, NURTURING).",
  signups: "New revenue customers with first payment in the selected period.",
  trials: "Active subscriptions in TRIALING status at period end.",
  customers: "Distinct paying revenue customers in the selected period.",
  conversionRate: "Customers divided by visitors when both are available.",
  marketingSpend: "Sum of marketing cost records in the selected period.",
  revenue: "Net revenue after refunds and credits (original amounts preserved).",
  mrr: "Sum of MRR from active and trialing subscriptions.",
  cac: "Marketing spend divided by new customers when both are available.",
  ltv: "Requires explicit methodology — not shown without configuration.",
  attributedRevenue: "Sum of attributed conversion revenue from the default attribution model.",
  organicTraffic: "Search Console clicks in the selected period.",
  paidTraffic: "Paid advertising clicks in the selected period.",
  socialEngagement: "Sum of likes, comments, shares and saves from social post metrics.",
};

export const EXECUTIVE_SECTIONS: Array<{ key: ExecutiveSection; label: string; href: string }> = [
  { key: "overview", label: "Executive Overview", href: "/analytics/executive" },
  { key: "acquisition", label: "Acquisition", href: "/analytics/executive/acquisition" },
  { key: "social", label: "Social", href: "/analytics/executive/social" },
  { key: "search", label: "Search", href: "/analytics/executive/search" },
  { key: "advertising", label: "Advertising", href: "/analytics/executive/advertising" },
  { key: "funnel", label: "Funnel", href: "/analytics/executive/funnel" },
  { key: "attribution", label: "Attribution", href: "/analytics/executive/attribution" },
  { key: "leads", label: "Leads", href: "/analytics/executive/leads" },
  { key: "revenue", label: "Revenue", href: "/analytics/executive/revenue" },
  { key: "data-health", label: "Data Health", href: "/analytics/executive/data-health" },
];

export const EMAIL_PERFORMANCE_EXTENSION =
  "Email performance metrics require an email provider connector (extension point).";

export const CHARGEBACK_EXTENSION = "Chargeback tracking reserved for future provider integration.";

export const GROSS_MARGIN_EXTENSION = "Gross margin can be configured per brand for payback calculations.";
