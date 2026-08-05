export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "PLANNED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  PLANNED: "Planned",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const CAMPAIGN_OBJECTIVES = [
  "BRAND_AWARENESS",
  "LEAD_GENERATION",
  "WEBSITE_TRAFFIC",
  "ENGAGEMENT",
  "CONVERSIONS",
  "RETENTION",
] as const;

export type CampaignObjective = (typeof CAMPAIGN_OBJECTIVES)[number];

export const CAMPAIGN_OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  BRAND_AWARENESS: "Brand awareness",
  LEAD_GENERATION: "Lead generation",
  WEBSITE_TRAFFIC: "Website traffic",
  ENGAGEMENT: "Engagement",
  CONVERSIONS: "Conversions",
  RETENTION: "Retention",
};

export const CAMPAIGN_CHANNEL_OPTIONS = [
  "ORGANIC_SOCIAL",
  "PAID_SOCIAL",
  "EMAIL",
  "SEO",
  "PAID_SEARCH",
  "DISPLAY",
  "EVENTS",
  "PARTNERSHIPS",
] as const;

export type CampaignChannelType = (typeof CAMPAIGN_CHANNEL_OPTIONS)[number];

export const CAMPAIGN_CHANNEL_LABELS: Record<CampaignChannelType, string> = {
  ORGANIC_SOCIAL: "Organic social",
  PAID_SOCIAL: "Paid social",
  EMAIL: "Email",
  SEO: "SEO",
  PAID_SEARCH: "Paid search",
  DISPLAY: "Display",
  EVENTS: "Events",
  PARTNERSHIPS: "Partnerships",
};

export type CampaignOwner = {
  id: string;
  displayName: string | null;
  email: string;
};

export type CampaignChannel = {
  id: string;
  channelType: CampaignChannelType;
  provider?: string | null;
  budgetAmount?: number | null;
  notes?: string | null;
};

export type CampaignKpi = {
  id: string;
  name: string;
  targetValue?: number | null;
  unit?: string | null;
  currentValue?: number | null;
};

export type CampaignMember = {
  id: string;
  role?: string | null;
  addedAt: string;
  user: CampaignOwner;
};

export type CampaignActivity = {
  id: string;
  activityType: string;
  summary: string;
  createdAt: string;
  actor: CampaignOwner;
};

export type CampaignSummary = {
  id: string;
  name: string;
  description?: string | null;
  status: CampaignStatus;
  primaryObjective?: CampaignObjective | string | null;
  brandId: string;
  brandName?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  channelCount?: number;
  kpiCount?: number;
  memberCount?: number;
  version: number;
  updatedAt: string;
  owner?: CampaignOwner;
};

export type CampaignDetail = CampaignSummary & {
  strategy?: {
    narrative?: string | null;
    targetOutcomes?: string[];
  } | null;
  channels?: CampaignChannel[];
  audience?: {
    description?: string | null;
    segments?: string[];
    targetAudienceId?: string | null;
  } | null;
  kpis?: CampaignKpi[];
  members?: CampaignMember[];
  activities?: CampaignActivity[];
};

export type CampaignListResponse = {
  items: CampaignSummary[];
};

export type CampaignResponse = {
  campaign: CampaignDetail;
};

export type CampaignDraftInput = {
  brandId: string;
  name: string;
  description?: string;
  status?: CampaignStatus;
  primaryObjective?: CampaignObjective | string;
  channels?: CampaignChannelType[];
  startAt?: string;
  endAt?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
  audience?: {
    description?: string;
    segments?: string[];
  };
  kpis?: Array<{
    name: string;
    targetValue?: number;
    unit?: string;
  }>;
  strategy?: {
    narrative?: string;
    targetOutcomes?: string[];
  };
  version?: number;
};

export type CampaignDetailTab =
  | "overview"
  | "strategy"
  | "channels"
  | "budget"
  | "audience"
  | "kpis"
  | "content"
  | "assets"
  | "tasks"
  | "team"
  | "activity";

export const CAMPAIGN_WIZARD_STEPS = [
  "Basics",
  "Objective",
  "Channels",
  "Schedule",
  "Budget",
  "Audience",
  "KPIs",
  "Review",
] as const;

export type CampaignWizardStep = (typeof CAMPAIGN_WIZARD_STEPS)[number];
