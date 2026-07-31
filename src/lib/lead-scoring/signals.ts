import type { LeadSnapshot as CrmLeadSnapshot } from "@/lib/marketing-automation/conditions";
import {
  ALL_SIGNALS,
  ENGAGEMENT_SIGNALS,
  FIT_SIGNALS,
  NEGATIVE_SIGNALS,
  PROHIBITED_ATTRIBUTES,
  type EngagementSignal,
  type FitSignal,
  type NegativeSignal,
  type ProhibitedAttribute,
  type RuleOperator,
  type ScoringSignal,
  type SignalCategory,
} from "./constants";

export type {
  EngagementSignal,
  FitSignal,
  NegativeSignal,
  ProhibitedAttribute,
  RuleOperator,
  ScoringSignal,
  SignalCategory,
} from "./constants";

export type LeadSnapshot = CrmLeadSnapshot & {
  companySize?: string;
  industry?: string;
  annualRevenue?: number;
  employeeCount?: number;
  targetMarket?: string;
  productFit?: string;
  accountType?: string;
  emailOpens?: number;
  emailClicks?: number;
  pageViews?: number;
  contentDownloads?: number;
  demoRequested?: boolean;
  trialStarted?: boolean;
  formSubmissions?: number;
  lastEmailOpenAt?: Date | string;
  lastPageViewAt?: Date | string;
  meetingsBooked?: number;
  qualificationState?: string;
  suppressed?: boolean;
  unsubscribed?: boolean;
  bounced?: boolean;
  signalTimestamps?: Partial<Record<ScoringSignal, Date | string>>;
};

export type SignalDefinition = {
  key: ScoringSignal;
  category: SignalCategory;
  label: string;
  description: string;
  snapshotField: keyof LeadSnapshot | "tags";
  valueType: "string" | "number" | "boolean" | "date" | "array";
  decayable: boolean;
};

const FIT_DEFINITIONS: Record<FitSignal, Omit<SignalDefinition, "key" | "category">> = {
  TARGET_INDUSTRY: {
    label: "Target industry",
    description: "Lead industry matches target profile.",
    snapshotField: "industry",
    valueType: "string",
    decayable: false,
  },
  TARGET_COUNTRY: {
    label: "Target country",
    description: "Lead country matches target geography.",
    snapshotField: "country",
    valueType: "string",
    decayable: false,
  },
  COMPANY_SIZE_MATCH: {
    label: "Company size match",
    description: "Company size aligns with ideal customer profile.",
    snapshotField: "companySize",
    valueType: "string",
    decayable: false,
  },
  PRODUCT_INTEREST_MATCH: {
    label: "Product interest match",
    description: "Declared product interest matches scoring target.",
    snapshotField: "productInterest",
    valueType: "string",
    decayable: false,
  },
  REVENUE_BAND_MATCH: {
    label: "Revenue band match",
    description: "Annual revenue falls within target band.",
    snapshotField: "annualRevenue",
    valueType: "number",
    decayable: false,
  },
  EMPLOYEE_COUNT_MATCH: {
    label: "Employee count match",
    description: "Employee count aligns with ideal customer profile.",
    snapshotField: "employeeCount",
    valueType: "number",
    decayable: false,
  },
  ACCOUNT_TYPE_MATCH: {
    label: "Account type match",
    description: "Account type matches target segment.",
    snapshotField: "accountType",
    valueType: "string",
    decayable: false,
  },
  LANGUAGE_MATCH: {
    label: "Language match",
    description: "Preferred language matches target market.",
    snapshotField: "language",
    valueType: "string",
    decayable: false,
  },
  LIFECYCLE_STAGE_FIT: {
    label: "Lifecycle stage fit",
    description: "Lifecycle stage indicates buying readiness.",
    snapshotField: "lifecycleStage",
    valueType: "string",
    decayable: false,
  },
  TAG_FIT: {
    label: "Fit tag present",
    description: "Lead carries a positive-fit tag.",
    snapshotField: "tags",
    valueType: "array",
    decayable: false,
  },
};

const ENGAGEMENT_DEFINITIONS: Record<
  EngagementSignal,
  Omit<SignalDefinition, "key" | "category">
> = {
  EMAIL_OPEN: {
    label: "Email open",
    description: "Lead has opened marketing emails.",
    snapshotField: "emailOpens",
    valueType: "number",
    decayable: true,
  },
  EMAIL_CLICK: {
    label: "Email click",
    description: "Lead has clicked links in marketing emails.",
    snapshotField: "emailClicks",
    valueType: "number",
    decayable: true,
  },
  PAGE_VIEW: {
    label: "Page view",
    description: "Lead has viewed website pages.",
    snapshotField: "pageViews",
    valueType: "number",
    decayable: true,
  },
  CONTENT_DOWNLOAD: {
    label: "Content download",
    description: "Lead has downloaded gated content.",
    snapshotField: "contentDownloads",
    valueType: "number",
    decayable: true,
  },
  FORM_SUBMISSION: {
    label: "Form submission",
    description: "Lead has submitted a form.",
    snapshotField: "formSubmissions",
    valueType: "number",
    decayable: true,
  },
  DEMO_REQUESTED: {
    label: "Demo requested",
    description: "Lead has requested a product demo.",
    snapshotField: "demoRequested",
    valueType: "boolean",
    decayable: true,
  },
  TRIAL_STARTED: {
    label: "Trial started",
    description: "Lead has started a product trial.",
    snapshotField: "trialStarted",
    valueType: "boolean",
    decayable: true,
  },
  MEETING_BOOKED: {
    label: "Meeting booked",
    description: "Lead has booked a sales meeting.",
    snapshotField: "meetingsBooked",
    valueType: "number",
    decayable: true,
  },
  RECENT_ACTIVITY: {
    label: "Recent activity",
    description: "Lead has recent CRM activity.",
    snapshotField: "lastActivityAt",
    valueType: "date",
    decayable: true,
  },
  HIGH_EMAIL_ENGAGEMENT: {
    label: "High email engagement",
    description: "Email engagement level is high.",
    snapshotField: "emailEngagement",
    valueType: "string",
    decayable: true,
  },
  PRODUCT_EVENT: {
    label: "Product event",
    description: "Lead triggered a tracked product event.",
    snapshotField: "productEvent",
    valueType: "string",
    decayable: true,
  },
  CAMPAIGN_RESPONSE: {
    label: "Campaign response",
    description: "Lead responded to a marketing campaign.",
    snapshotField: "campaign",
    valueType: "string",
    decayable: true,
  },
};

const NEGATIVE_DEFINITIONS: Record<
  NegativeSignal,
  Omit<SignalDefinition, "key" | "category">
> = {
  EMAIL_UNSUBSCRIBED: {
    label: "Email unsubscribed",
    description: "Lead has unsubscribed from marketing emails.",
    snapshotField: "unsubscribed",
    valueType: "boolean",
    decayable: false,
  },
  CONSENT_WITHDRAWN: {
    label: "Consent withdrawn",
    description: "Marketing consent has been withdrawn.",
    snapshotField: "consentMarketing",
    valueType: "boolean",
    decayable: false,
  },
  SUPPRESSED: {
    label: "Suppressed",
    description: "Lead is on a suppression list.",
    snapshotField: "suppressed",
    valueType: "boolean",
    decayable: false,
  },
  INACTIVE: {
    label: "Inactive",
    description: "Lead has no recent activity beyond inactivity threshold.",
    snapshotField: "lastActivityAt",
    valueType: "date",
    decayable: false,
  },
  BOUNCED_EMAIL: {
    label: "Bounced email",
    description: "Lead email address has bounced.",
    snapshotField: "bounced",
    valueType: "boolean",
    decayable: false,
  },
  DISQUALIFIED_STATUS: {
    label: "Disqualified status",
    description: "Lead status indicates disqualification.",
    snapshotField: "status",
    valueType: "string",
    decayable: false,
  },
  NEGATIVE_TAG: {
    label: "Negative tag",
    description: "Lead carries a negative scoring tag.",
    snapshotField: "tags",
    valueType: "array",
    decayable: false,
  },
  COMPETITOR_TAG: {
    label: "Competitor tag",
    description: "Lead is tagged as a competitor contact.",
    snapshotField: "tags",
    valueType: "array",
    decayable: false,
  },
  SUPPORT_ISSUE: {
    label: "Support issue",
    description: "Open support issue affects scoring.",
    snapshotField: "productEvent",
    valueType: "string",
    decayable: false,
  },
  CHURNED_SUBSCRIPTION: {
    label: "Churned subscription",
    description: "Subscription state indicates churn.",
    snapshotField: "subscriptionState",
    valueType: "string",
    decayable: false,
  },
};

function buildDefinitions(): Record<ScoringSignal, SignalDefinition> {
  const definitions = {} as Record<ScoringSignal, SignalDefinition>;

  for (const key of FIT_SIGNALS) {
    definitions[key] = { key, category: "FIT", ...FIT_DEFINITIONS[key] };
  }
  for (const key of ENGAGEMENT_SIGNALS) {
    definitions[key] = { key, category: "ENGAGEMENT", ...ENGAGEMENT_DEFINITIONS[key] };
  }
  for (const key of NEGATIVE_SIGNALS) {
    definitions[key] = { key, category: "NEGATIVE", ...NEGATIVE_DEFINITIONS[key] };
  }

  return definitions;
}

export const SIGNAL_DEFINITIONS = buildDefinitions();

export type SignalValidationResult = {
  valid: boolean;
  issues: string[];
};

export function isApprovedSignal(signal: string): signal is ScoringSignal {
  return (ALL_SIGNALS as readonly string[]).includes(signal);
}

export function isProhibitedAttribute(attribute: string): attribute is ProhibitedAttribute {
  return (PROHIBITED_ATTRIBUTES as readonly string[]).includes(attribute.toLowerCase());
}

export function validateSignal(signal: string, field?: string): SignalValidationResult {
  const issues: string[] = [];

  if (!isApprovedSignal(signal)) {
    issues.push(`Unknown signal: ${signal}`);
  }

  if (field && isProhibitedAttribute(field)) {
    issues.push(`Field "${field}" is a prohibited attribute.`);
  }

  return { valid: issues.length === 0, issues };
}

export function resolveSignalValue(
  snapshot: LeadSnapshot,
  signal: ScoringSignal,
): unknown {
  const definition = SIGNAL_DEFINITIONS[signal];
  if (!definition) return undefined;

  const field = definition.snapshotField;
  if (field === "tags") return snapshot.tags ?? [];
  return snapshot[field];
}

export function getSignalsByCategory(category: SignalCategory): SignalDefinition[] {
  return Object.values(SIGNAL_DEFINITIONS).filter((def) => def.category === category);
}
