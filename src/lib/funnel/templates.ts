import type { FunnelTemplateType, FunnelStepType } from "@prisma/client";
import type { FunnelStepMatchingRules } from "@/lib/funnel/types";

export type FunnelTemplateStep = {
  name: string;
  stepType: FunnelStepType;
  matchingRules: FunnelStepMatchingRules;
  requirement?: "REQUIRED" | "OPTIONAL";
  maxTimeToNextStepMs?: number;
};

export type FunnelTemplateDefinition = {
  templateType: FunnelTemplateType;
  name: string;
  description: string;
  steps: FunnelTemplateStep[];
};

export const CRESCO_GRANTS_FUNNEL_TEMPLATE: FunnelTemplateDefinition = {
  templateType: "CRESCO_GRANTS",
  name: "Cresco Grants conversion funnel",
  description: "Visitor through grant discovery to subscription for Cresco Grants Intelligence.",
  steps: [
    { name: "Visitor", stepType: "PAGE", matchingRules: { eventName: "page_view" } },
    { name: "Signup started", stepType: "EVENT", matchingRules: { eventName: "signup_started" } },
    { name: "Signup completed", stepType: "EVENT", matchingRules: { eventName: "signup_completed" } },
    { name: "Email verified", stepType: "EVENT", matchingRules: { eventName: "email_verified" } },
    { name: "Grant viewed", stepType: "EVENT", matchingRules: { eventName: "grant_viewed" } },
    { name: "Grant saved", stepType: "EVENT", matchingRules: { eventName: "grant_saved" } },
    { name: "Application created", stepType: "EVENT", matchingRules: { eventName: "application_created" } },
    { name: "Subscription started", stepType: "CONVERSION", matchingRules: { conversionKey: "subscription_started" } },
  ],
};

export const CAPITAL_CRESCO_TERMINAL_FUNNEL_TEMPLATE: FunnelTemplateDefinition = {
  templateType: "CAPITAL_CRESCO_TERMINAL",
  name: "Capital Cresco Terminal conversion funnel",
  description: "Visitor through company analysis to subscription for Capital Cresco Terminal.",
  steps: [
    { name: "Visitor", stepType: "PAGE", matchingRules: { eventName: "page_view" } },
    { name: "Signup completed", stepType: "EVENT", matchingRules: { eventName: "signup_completed" } },
    { name: "Company analysed", stepType: "EVENT", matchingRules: { eventName: "company_analysed" } },
    { name: "Report imported", stepType: "EVENT", matchingRules: { eventName: "report_imported" } },
    { name: "Demo requested", stepType: "EVENT", matchingRules: { eventName: "demo_requested" } },
    { name: "Trial started", stepType: "EVENT", matchingRules: { eventName: "trial_started" } },
    { name: "Subscription started", stepType: "CONVERSION", matchingRules: { conversionKey: "subscription_started" } },
  ],
};

export const FUNNEL_TEMPLATES: Record<FunnelTemplateType, FunnelTemplateDefinition> = {
  CRESCO_GRANTS: CRESCO_GRANTS_FUNNEL_TEMPLATE,
  CAPITAL_CRESCO_TERMINAL: CAPITAL_CRESCO_TERMINAL_FUNNEL_TEMPLATE,
};

export function getFunnelTemplate(templateType: FunnelTemplateType): FunnelTemplateDefinition {
  return FUNNEL_TEMPLATES[templateType];
}
