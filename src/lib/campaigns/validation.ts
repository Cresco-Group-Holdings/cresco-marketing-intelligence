import type { Campaign, CampaignChannel, CampaignKpi } from "@prisma/client";
import { isIsoCurrencyCode } from "@/lib/campaigns/constants";

export type ValidationIssue = { field: string; message: string };

export function validateCampaignDates(
  startAt?: Date | null,
  endAt?: Date | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (startAt && endAt && endAt < startAt) {
    issues.push({ field: "endAt", message: "End date must be on or after start date." });
  }
  return issues;
}

export function validateBudget(
  budgetAmount?: number | null,
  budgetCurrency?: string | null,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (budgetAmount != null && budgetAmount < 0) {
    issues.push({ field: "budgetAmount", message: "Budget amount cannot be negative." });
  }
  if (budgetCurrency && !isIsoCurrencyCode(budgetCurrency)) {
    issues.push({ field: "budgetCurrency", message: "Budget currency must be a valid ISO 4217 code." });
  }
  if (budgetAmount != null && !budgetCurrency) {
    issues.push({ field: "budgetCurrency", message: "Budget currency is required when amount is set." });
  }
  return issues;
}

export function validateReadiness(campaign: {
  name: string;
  primaryObjective: Campaign["primaryObjective"];
  startAt: Date | null;
  endAt: Date | null;
  channels: Pick<CampaignChannel, "id">[];
  kpis: Pick<CampaignKpi, "id">[];
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!campaign.primaryObjective) {
    issues.push({ field: "primaryObjective", message: "Primary objective is required before marking ready." });
  }
  if (!campaign.startAt || !campaign.endAt) {
    issues.push({ field: "schedule", message: "Start and end dates are required before marking ready." });
  }
  if (!campaign.channels.length) {
    issues.push({ field: "channels", message: "At least one channel is required before marking ready." });
  }
  if (!campaign.kpis.length) {
    issues.push({ field: "kpis", message: "At least one KPI is required before marking ready." });
  }
  return issues;
}

export function validateActivation(campaign: {
  status: Campaign["status"];
  channels: Array<Pick<CampaignChannel, "status">>;
}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (campaign.status !== "READY") {
    issues.push({ field: "status", message: "Campaign must be ready before activation." });
  }
  const hasActiveChannel = campaign.channels.some((channel) => channel.status !== "CANCELLED");
  if (!hasActiveChannel) {
    issues.push({ field: "channels", message: "At least one non-cancelled channel is required to activate." });
  }
  return issues;
}

export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(" ");
}
