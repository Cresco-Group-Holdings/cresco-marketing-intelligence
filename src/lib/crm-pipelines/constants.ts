export const PIPELINE_TYPES = [
  "GRANTS_SUBSCRIPTION", "CAPITAL_TERMINAL", "ENTERPRISE_SALES",
  "PARTNERSHIPS", "MANAGED_MARKETING", "CUSTOM",
] as const;

export const STAGE_CATEGORIES = [
  "OPEN", "QUALIFICATION", "DISCOVERY", "EVALUATION", "PROPOSAL",
  "NEGOTIATION", "TRIAL", "WON", "LOST",
] as const;

export const OPPORTUNITY_STATUSES = ["OPEN", "WON", "LOST", "ARCHIVED"] as const;

export const WON_EVIDENCE_TYPES = [
  "SUBSCRIPTION_CONFIRMED", "PAYMENT_COMPLETED", "AGREEMENT_SIGNED", "AUTHORISED_CONFIRMATION",
] as const;

export const CONTACT_ROLE_TYPES = [
  "DECISION_MAKER", "CHAMPION", "INFLUENCER", "ECONOMIC_BUYER", "TECHNICAL_EVALUATOR", "OTHER",
] as const;

export const DEFAULT_PIPELINE_TEMPLATES = [
  { pipelineType: "GRANTS_SUBSCRIPTION", name: "Cresco Grants", stages: ["Qualification", "Discovery", "Proposal", "Trial", "Won", "Lost"] },
  { pipelineType: "CAPITAL_TERMINAL", name: "Capital Cresco Terminal", stages: ["Qualification", "Evaluation", "Proposal", "Negotiation", "Won", "Lost"] },
  { pipelineType: "ENTERPRISE_SALES", name: "Enterprise Sales", stages: ["Open", "Discovery", "Evaluation", "Proposal", "Negotiation", "Won", "Lost"] },
  { pipelineType: "PARTNERSHIPS", name: "Partnerships", stages: ["Open", "Qualification", "Discovery", "Proposal", "Won", "Lost"] },
  { pipelineType: "MANAGED_MARKETING", name: "Managed Marketing Services", stages: ["Open", "Discovery", "Proposal", "Negotiation", "Won", "Lost"] },
] as const;

export const STALE_OPPORTUNITY_DAYS = 14;
export const STAGE_REVERSAL_WINDOW_DAYS = 30;
