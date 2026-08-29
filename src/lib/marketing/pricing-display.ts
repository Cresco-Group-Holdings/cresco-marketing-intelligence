import { DEFAULT_PLAN_CATALOG } from "@/lib/billing/plan-catalog";

export type PublicPlanDisplay = {
  key: string;
  displayName: string;
  description: string;
  monthlyPriceLabel: string;
  annualPriceLabel: string | null;
  highlights: string[];
  ctaLabel: string;
  featured?: boolean;
};

function formatPrice(cents: number): string {
  if (cents === 0) {
    return "£0";
  }
  return `£${(cents / 100).toLocaleString("en-GB", { minimumFractionDigits: 0 })}`;
}

function planHighlights(planKey: string): string[] {
  switch (planKey) {
    case "free":
      return ["2 team members", "1 brand", "2 provider connections", "10k AI tokens / month"];
    case "trial":
      return ["14-day full-feature trial", "5 brands", "100k AI tokens / month", "API access"];
    case "starter":
      return ["5 team members", "10 brands", "10 provider connections", "250k AI tokens / month"];
    case "professional":
      return ["25 team members", "50 brands", "Advanced permissions", "1M AI tokens / month"];
    case "business":
      return ["100 team members", "500 active campaigns", "5M AI tokens / month", "365-day audit retention"];
    case "enterprise":
      return ["Custom limits", "Dedicated support", "Advanced security controls", "Contact sales"];
    default:
      return [];
  }
}

/** Customer-facing plans sourced from the canonical billing catalogue. */
export function getPublicPricingPlans(): PublicPlanDisplay[] {
  return DEFAULT_PLAN_CATALOG.filter((plan) => plan.key !== "trial").map((plan) => {
    const isEnterprise = plan.key === "enterprise";
    const isFree = plan.key === "free";

    return {
      key: plan.key,
      displayName: plan.displayName,
      description: plan.description,
      monthlyPriceLabel: isEnterprise ? "Custom" : formatPrice(plan.monthlyPriceCents),
      annualPriceLabel:
        !isEnterprise && !isFree && plan.annualPriceCents > 0
          ? `${formatPrice(plan.annualPriceCents)} / year`
          : null,
      highlights: planHighlights(plan.key),
      ctaLabel: isEnterprise ? "Contact sales" : isFree ? "Start free" : "Start trial",
      featured: plan.key === "starter",
    };
  });
}
