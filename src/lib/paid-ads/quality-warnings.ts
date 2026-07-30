export type PaidAdsQualityWarning = {
  rule: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
};
