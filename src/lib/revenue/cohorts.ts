import type { RevenueCohortDimension } from "@prisma/client";

export type CohortCustomer = {
  customerId: string;
  signupAt: Date;
  totalRevenue: number;
  dimensionValues: Partial<Record<RevenueCohortDimension, string>>;
};

export type CohortResult = {
  dimension: RevenueCohortDimension;
  cohortKey: string;
  customerCount: number;
  totalRevenue: number;
  mrr: number;
};

export function buildCohortResults(
  customers: CohortCustomer[],
  dimension: RevenueCohortDimension,
): CohortResult[] {
  const groups = new Map<string, CohortCustomer[]>();

  for (const customer of customers) {
    const key =
      dimension === "SIGNUP_MONTH"
        ? customer.signupAt.toISOString().slice(0, 7)
        : customer.dimensionValues[dimension] ?? "unknown";
    const list = groups.get(key) ?? [];
    list.push(customer);
    groups.set(key, list);
  }

  return [...groups.entries()].map(([cohortKey, members]) => ({
    dimension,
    cohortKey,
    customerCount: members.length,
    totalRevenue: members.reduce((sum, c) => sum + c.totalRevenue, 0),
    mrr: members.reduce((sum, c) => sum + c.totalRevenue / 12, 0),
  }));
}
