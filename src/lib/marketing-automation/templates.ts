import { METRIC_LIMITATIONS } from "./constants";
import type { AutomationGraph } from "./graph-validation";

export type JourneyTemplateType =
  | "CRESCO_GRANTS_LEAD_NURTURE"
  | "CAPITAL_TRIAL"
  | "DEMO_FOLLOW_UP";

export type JourneyTemplateDefinition = {
  templateType: JourneyTemplateType;
  templateKey: string;
  name: string;
  description: string;
  product: "CRESCO_GRANTS" | "CAPITAL_CRESCO" | "GENERAL";
  enabled: boolean;
  repeatPolicy: "ONE_TIME" | "ALLOW_REPEAT" | "ALLOW_AFTER_COMPLETION";
  graph: AutomationGraph;
};

const grantsLeadNurtureGraph: AutomationGraph = {
  nodes: [
    { id: "trigger", type: "TRIGGER", label: "Grant interest form", config: { triggerType: "FORM_SUBMITTED", formType: "GRANT_INTEREST" } },
    { id: "confirmation", type: "ACTION", label: "Confirmation email", config: { actionType: "SEND_EMAIL", templateKey: "grants_confirmation", requiresApproval: true } },
    { id: "wait-1", type: "DELAY", label: "Wait 1 day", config: { delayType: "FIXED_DURATION", durationMinutes: 1_440 } },
    { id: "education", type: "ACTION", label: "Educational email", config: { actionType: "SEND_EMAIL", templateKey: "grants_education", requiresApproval: true } },
    { id: "wait-2", type: "DELAY", label: "Wait 3 days", config: { delayType: "FIXED_DURATION", durationMinutes: 4_320 } },
    { id: "guide", type: "ACTION", label: "Grant-discovery guide", config: { actionType: "SEND_EMAIL", templateKey: "grants_discovery_guide", requiresApproval: true } },
    { id: "wait-3", type: "DELAY", label: "Wait 5 days", config: { delayType: "FIXED_DURATION", durationMinutes: 7_200 } },
    { id: "reminder", type: "ACTION", label: "Product reminder", config: { actionType: "SEND_EMAIL", templateKey: "grants_product_reminder", requiresApproval: true } },
    { id: "wait-4", type: "DELAY", label: "Wait 2 days", config: { delayType: "FIXED_DURATION", durationMinutes: 2_880 } },
    { id: "cta", type: "ACTION", label: "Demo or signup CTA", config: { actionType: "SEND_EMAIL", templateKey: "grants_demo_cta", requiresApproval: true } },
    { id: "end", type: "END", label: "Journey complete", config: {} },
  ],
  edges: [
    { id: "e1", sourceNodeId: "trigger", targetNodeId: "confirmation" },
    { id: "e2", sourceNodeId: "confirmation", targetNodeId: "wait-1" },
    { id: "e3", sourceNodeId: "wait-1", targetNodeId: "education" },
    { id: "e4", sourceNodeId: "education", targetNodeId: "wait-2" },
    { id: "e5", sourceNodeId: "wait-2", targetNodeId: "guide" },
    { id: "e6", sourceNodeId: "guide", targetNodeId: "wait-3" },
    { id: "e7", sourceNodeId: "wait-3", targetNodeId: "reminder" },
    { id: "e8", sourceNodeId: "reminder", targetNodeId: "wait-4" },
    { id: "e9", sourceNodeId: "wait-4", targetNodeId: "cta" },
    { id: "e10", sourceNodeId: "cta", targetNodeId: "end" },
  ],
  exitRules: [
    { exitReason: "SUBSCRIPTION_STARTED", evaluateBeforeMessaging: true },
    { exitReason: "CONSENT_WITHDRAWN", evaluateBeforeMessaging: true },
    { exitReason: "LEAD_SUPPRESSED", evaluateBeforeMessaging: true },
  ],
};

const capitalTrialGraph: AutomationGraph = {
  nodes: [
    { id: "trigger", type: "TRIGGER", label: "Trial signup", config: { triggerType: "TRIAL_STARTED" } },
    { id: "onboarding", type: "ACTION", label: "Onboarding email", config: { actionType: "SEND_EMAIL", templateKey: "capital_onboarding", requiresApproval: true } },
    { id: "wait-1", type: "DELAY", label: "Wait 2 days", config: { delayType: "FIXED_DURATION", durationMinutes: 2_880 } },
    { id: "analysis-reminder", type: "ACTION", label: "Company-analysis reminder", config: { actionType: "SEND_EMAIL", templateKey: "capital_analysis_reminder", requiresApproval: true } },
    { id: "wait-2", type: "DELAY", label: "Wait 3 days", config: { delayType: "FIXED_DURATION", durationMinutes: 4_320 } },
    { id: "import-reminder", type: "ACTION", label: "Report-import reminder", config: { actionType: "SEND_EMAIL", templateKey: "capital_import_reminder", requiresApproval: true } },
    { id: "wait-3", type: "DELAY", label: "Wait until trial ending", config: { delayType: "WAIT_FOR_EVENT", waitEventType: "TRIAL_ENDING", maxWaitMinutes: 20_160 } },
    { id: "trial-warning", type: "ACTION", label: "Trial-ending warning", config: { actionType: "SEND_EMAIL", templateKey: "capital_trial_ending", requiresApproval: true } },
    { id: "wait-4", type: "DELAY", label: "Wait 1 day", config: { delayType: "FIXED_DURATION", durationMinutes: 1_440 } },
    { id: "subscription-cta", type: "ACTION", label: "Subscription CTA", config: { actionType: "SEND_EMAIL", templateKey: "capital_subscription_cta", requiresApproval: true } },
    { id: "end", type: "END", label: "Journey complete", config: {} },
  ],
  edges: [
    { id: "e1", sourceNodeId: "trigger", targetNodeId: "onboarding" },
    { id: "e2", sourceNodeId: "onboarding", targetNodeId: "wait-1" },
    { id: "e3", sourceNodeId: "wait-1", targetNodeId: "analysis-reminder" },
    { id: "e4", sourceNodeId: "analysis-reminder", targetNodeId: "wait-2" },
    { id: "e5", sourceNodeId: "wait-2", targetNodeId: "import-reminder" },
    { id: "e6", sourceNodeId: "import-reminder", targetNodeId: "wait-3" },
    { id: "e7", sourceNodeId: "wait-3", targetNodeId: "trial-warning" },
    { id: "e8", sourceNodeId: "trial-warning", targetNodeId: "wait-4" },
    { id: "e9", sourceNodeId: "wait-4", targetNodeId: "subscription-cta" },
    { id: "e10", sourceNodeId: "subscription-cta", targetNodeId: "end" },
  ],
  exitRules: [
    { exitReason: "SUBSCRIPTION_STARTED", evaluateBeforeMessaging: true },
    { exitReason: "CONSENT_WITHDRAWN", evaluateBeforeMessaging: true },
  ],
};

const demoFollowUpGraph: AutomationGraph = {
  nodes: [
    { id: "trigger", type: "TRIGGER", label: "Demo requested", config: { triggerType: "DEMO_REQUESTED" } },
    { id: "assign-owner", type: "ACTION", label: "Assign owner", config: { actionType: "ASSIGN_OWNER" } },
    { id: "create-task", type: "ACTION", label: "Create follow-up task", config: { actionType: "CREATE_TASK", title: "Contact demo request lead", taskType: "DEMO" } },
    { id: "confirmation", type: "ACTION", label: "Confirmation email", config: { actionType: "SEND_EMAIL", templateKey: "demo_confirmation", requiresApproval: true } },
    { id: "wait-1", type: "DELAY", label: "Wait until meeting day", config: { delayType: "UNTIL_DAYPART", daypartStart: "09:00", daypartEnd: "17:00", timezone: "Europe/London" } },
    { id: "meeting-reminder", type: "ACTION", label: "Meeting reminder", config: { actionType: "SEND_EMAIL", templateKey: "demo_meeting_reminder", requiresApproval: true } },
    { id: "wait-2", type: "DELAY", label: "Wait 1 day after meeting", config: { delayType: "FIXED_DURATION", durationMinutes: 1_440 } },
    { id: "post-meeting-task", type: "ACTION", label: "Post-meeting follow-up task", config: { actionType: "CREATE_TASK", title: "Post-demo follow-up", taskType: "FOLLOW_UP" } },
    { id: "end", type: "END", label: "Journey complete", config: {} },
  ],
  edges: [
    { id: "e1", sourceNodeId: "trigger", targetNodeId: "assign-owner" },
    { id: "e2", sourceNodeId: "assign-owner", targetNodeId: "create-task" },
    { id: "e3", sourceNodeId: "create-task", targetNodeId: "confirmation" },
    { id: "e4", sourceNodeId: "confirmation", targetNodeId: "wait-1" },
    { id: "e5", sourceNodeId: "wait-1", targetNodeId: "meeting-reminder" },
    { id: "e6", sourceNodeId: "meeting-reminder", targetNodeId: "wait-2" },
    { id: "e7", sourceNodeId: "wait-2", targetNodeId: "post-meeting-task" },
    { id: "e8", sourceNodeId: "post-meeting-task", targetNodeId: "end" },
  ],
  exitRules: [
    { exitReason: "CONSENT_WITHDRAWN", evaluateBeforeMessaging: true },
    { exitReason: "LEAD_SUPPRESSED", evaluateBeforeMessaging: true },
  ],
};

export const CRESCO_GRANTS_LEAD_NURTURE_TEMPLATE: JourneyTemplateDefinition = {
  templateType: "CRESCO_GRANTS_LEAD_NURTURE",
  templateKey: "cresco_grants_lead_nurture",
  name: "Cresco Grants lead nurture",
  description: "Grant interest form through educational content to demo/signup CTA.",
  product: "CRESCO_GRANTS",
  enabled: false,
  repeatPolicy: "ONE_TIME",
  graph: grantsLeadNurtureGraph,
};

export const CAPITAL_TRIAL_TEMPLATE: JourneyTemplateDefinition = {
  templateType: "CAPITAL_TRIAL",
  templateKey: "capital_cresco_trial",
  name: "Capital Cresco trial journey",
  description: "Trial onboarding through reminders to subscription CTA.",
  product: "CAPITAL_CRESCO",
  enabled: false,
  repeatPolicy: "ALLOW_REPEAT",
  graph: capitalTrialGraph,
};

export const DEMO_FOLLOW_UP_TEMPLATE: JourneyTemplateDefinition = {
  templateType: "DEMO_FOLLOW_UP",
  templateKey: "demo_follow_up",
  name: "Demo follow-up",
  description: "Assign owner, create tasks, and send confirmation and reminder emails.",
  product: "GENERAL",
  enabled: false,
  repeatPolicy: "ONE_TIME",
  graph: demoFollowUpGraph,
};

export const JOURNEY_TEMPLATES: Record<JourneyTemplateType, JourneyTemplateDefinition> = {
  CRESCO_GRANTS_LEAD_NURTURE: CRESCO_GRANTS_LEAD_NURTURE_TEMPLATE,
  CAPITAL_TRIAL: CAPITAL_TRIAL_TEMPLATE,
  DEMO_FOLLOW_UP: DEMO_FOLLOW_UP_TEMPLATE,
};

export function getJourneyTemplate(templateType: JourneyTemplateType): JourneyTemplateDefinition {
  return JOURNEY_TEMPLATES[templateType];
}

export function listJourneyTemplates(): JourneyTemplateDefinition[] {
  return Object.values(JOURNEY_TEMPLATES);
}

export function buildMetricLimitations(): Record<string, string> {
  return { ...METRIC_LIMITATIONS };
}
