import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import type { ContentThemeKey } from "@/lib/content-intelligence/themes";

export type ContentObjective =
  | "awareness"
  | "education"
  | "engagement"
  | "lead_generation"
  | "conversion"
  | "retention"
  | "product_adoption"
  | "authority"
  | "community_growth"
  | "traffic"
  | "event_promotion";

export type FunnelStage =
  | "awareness"
  | "consideration"
  | "evaluation"
  | "conversion"
  | "retention"
  | "advocacy";

export type EvidenceStrength = "emerging" | "moderate" | "strong";

export type ContentPerformanceClass =
  | "winning"
  | "strong"
  | "typical"
  | "weak"
  | "insufficient_data";

export type BriefCreationMode =
  | "manual"
  | "campaign"
  | "opportunity"
  | "winning_content"
  | "competitor_signal";

export type BrandAlignmentDimension =
  | "messaging"
  | "tone"
  | "offer"
  | "audience"
  | "vocabulary"
  | "compliance"
  | "cta";

export type BrandAlignmentState = "strong" | "moderate" | "weak" | "missing" | "not_evaluated";

export type ContentBrief = {
  id?: string;
  mode: BriefCreationMode;
  objective: ContentObjective;
  funnelStage?: FunnelStage | null;
  audienceId?: string | null;
  audienceLabel?: string | null;
  audiencePain?: string | null;
  offerId?: string | null;
  offerLabel?: string | null;
  campaignId?: string | null;
  campaignLabel?: string | null;
  contentPillar?: ContentThemeKey | string | null;
  keyMessage: string;
  supportingMessages: string[];
  proofPoints: string[];
  differentiators: string[];
  cta: string;
  channelStrategy: string[];
  suggestedFormats: string[];
  brandVoice?: string | null;
  prohibitedClaims: string[];
  evidenceNotes: string[];
  successMetric?: string | null;
  sourceOpportunityId?: string | null;
  sourceContentId?: string | null;
};

export type MasterContent = {
  id?: string;
  briefId?: string | null;
  title: string;
  summary?: string | null;
  hook?: string | null;
  body: string;
  keyPoints: string[];
  cta?: string | null;
  contentPillar?: string | null;
  audienceLabel?: string | null;
  offerLabel?: string | null;
  objective?: ContentObjective | null;
  campaignLabel?: string | null;
  status: "draft" | "review" | "approved" | "published";
  generationMetadata?: {
    aiRequestId?: string;
    provider?: string;
    model?: string;
    generatedAt?: string;
    humanEdited?: boolean;
  };
};

export type ContentStrategy = {
  primaryObjective: ContentObjective | null;
  funnelStage: FunnelStage | null;
  targetAudienceIds: string[];
  targetAudienceLabels: string[];
  offerIds: string[];
  offerLabels: string[];
  contentPillars: string[];
  primaryChannels: string[];
  secondaryChannels: string[];
  publishingCadence?: string | null;
  keyMessages: string[];
  ctaStrategy?: string | null;
  constraints: string[];
  complianceNotes: string[];
  successMetrics: string[];
  narrative?: string | null;
};

export type ContentThemeDefinition = {
  key: string;
  label: string;
  description?: string | null;
  objective?: ContentObjective | null;
  preferredAudiences: string[];
  preferredChannels: string[];
  active: boolean;
  performanceSummary?: {
    reach: number | null;
    engagement: number | null;
    posts: number;
    classification: ContentPerformanceClass;
  } | null;
};

export type ContentOpportunity = {
  id: string;
  source:
    | "winning_content"
    | "calendar_gap"
    | "campaign"
    | "theme_gap"
    | "competitor_gap"
    | "audience_need"
    | "repurpose"
    | "format_signal";
  title: string;
  finding: string;
  evidence: Array<{ label: string; value: string }>;
  whyItMatters: string;
  targetAudience?: string | null;
  recommendedContent: string;
  recommendedChannels: string[];
  evidenceStrength: EvidenceStrength;
  action: { label: string; href: string };
};

export type ContentLearning = {
  id: string;
  pattern: string;
  observation: string;
  evidenceStrength: EvidenceStrength;
  dimension: "theme" | "format" | "hook" | "cta" | "channel" | "audience";
  sampleSize?: number | null;
  disclaimer: string;
};

export type NextContentRecommendation = {
  id: string;
  title: string;
  topic: string;
  format: string;
  channels: string[];
  why: string[];
  evidence: Array<{ label: string; value: string }>;
  evidenceStrength: EvidenceStrength;
  action: { label: string; href: string };
};

export type BrandContextReadiness = {
  overallScore: number;
  complete: boolean;
  missing: Array<{ category: string; label: string }>;
  impactMessage: string;
  completeBrandHref: string;
};

export type BrandAlignmentResult = {
  score: number | null;
  scoreLabel: string;
  dimensions: Array<{
    key: BrandAlignmentDimension;
    label: string;
    state: BrandAlignmentState;
    explanation: string;
  }>;
  disclaimer: string;
};

export type ContentQualityIssue = {
  id: string;
  severity: "info" | "warning";
  message: string;
  action?: string | null;
};

export type ContentQualityResult = {
  issueCount: number;
  issues: ContentQualityIssue[];
  summary: string;
};

export type ContentIntelligenceKpi = {
  label: string;
  value: string;
  change?: number | null;
  comparisonLabel?: string;
  state?: "normal" | "empty" | "partial" | "stale";
  stateMessage?: string;
};

export type ContentPriority = {
  id: string;
  title: string;
  urgency: "critical" | "high" | "normal";
  context: string;
  action: { label: string; href: string };
};

export type ThemePerformanceRow = {
  theme: string;
  label: string;
  reach: number | null;
  engagement: number | null;
  clicks: number | null;
  posts: number;
  classification: ContentPerformanceClass;
};

export type ContentPipelineItem = {
  id: string;
  title: string;
  status: string;
  contentPillar?: string | null;
  campaignLabel?: string | null;
  channel?: string | null;
  dueAt?: string | null;
  href: string;
};

export type ContentIntelligenceWorkspace = {
  hasBrandContext: boolean;
  dateRange: { label: string; from: string; to: string };
  freshness: { label: string; state: DataFreshnessState };
  kpis: ContentIntelligenceKpi[];
  priorities: ContentPriority[];
  nextRecommendation: NextContentRecommendation | null;
  opportunities: ContentOpportunity[];
  strategy: ContentStrategy;
  themes: ContentThemeDefinition[];
  themePerformance: ThemePerformanceRow[];
  learnings: ContentLearning[];
  pipeline: ContentPipelineItem[];
  topPerforming: Array<{
    id: string;
    title: string;
    channel: string;
    metricLabel: string;
    metricValue: string;
    classification: ContentPerformanceClass;
    href: string;
  }>;
  weakPerforming: Array<{
    id: string;
    title: string;
    channel: string;
    metricLabel: string;
    metricValue: string;
    classification: ContentPerformanceClass;
    href: string;
  }>;
  brandReadiness: BrandContextReadiness;
  upcomingPublications: Array<{
    id: string;
    title: string;
    channel: string;
    scheduledFor: string;
    status: string;
  }>;
};
