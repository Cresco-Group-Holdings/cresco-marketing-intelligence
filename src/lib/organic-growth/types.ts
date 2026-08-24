import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";
import type { MarketingSignal } from "@/lib/marketing-intelligence/types";
import type { SocialProvider } from "@prisma/client";

export type OrganicProviderAvailability =
  | "connected"
  | "not_connected"
  | "reauth_required"
  | "syncing"
  | "stale"
  | "error"
  | "coming_soon"
  | "planned";

export type OrganicProviderTier = "core" | "secondary";

export type OrganicProviderDefinition = {
  provider: SocialProvider | "THREADS" | "PINTEREST" | "REDDIT" | "BLUESKY" | "MEDIUM" | "SUBSTACK" | "TELEGRAM";
  label: string;
  tier: OrganicProviderTier;
  availability: OrganicProviderAvailability;
  accountRead: boolean;
  analytics: boolean;
  publish: boolean;
  schedule: boolean;
  connectHref: string;
  formats: string[];
};

export type AccountHealthState =
  | "healthy"
  | "syncing"
  | "stale"
  | "error"
  | "reauth_required"
  | "not_connected"
  | "coming_soon";

export type OrganicAccountRow = {
  id: string;
  provider: string;
  providerKey: SocialProvider | string;
  displayName: string;
  handle: string | null;
  connectionState: AccountHealthState;
  connectionLabel: string;
  lastSyncAt: string | null;
  freshness: DataFreshnessState;
  freshnessLabel: string;
  followers: number | null;
  followerGrowth: number | null;
  followerGrowthRate: number | null;
  reach: number | null;
  engagementRate: number | null;
  publishingStatus: "active" | "idle" | "none";
  scheduledCount: number;
  actions: {
    performanceHref: string;
    createHref: string;
    queueHref: string;
    connectHref: string;
  };
};

export type OrganicGrowthScoreDimension = {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  explanation: string;
  recommendedImprovement?: string;
  unavailable?: boolean;
};

export type OrganicGrowthScore = {
  total: number;
  maxTotal: number;
  dimensions: OrganicGrowthScoreDimension[];
};

export type MetricDisplayState = "normal" | "loading" | "empty" | "partial" | "stale" | "unavailable";

export type OrganicExecutiveKpi = {
  label: string;
  value: string;
  change: number | null;
  comparisonLabel: string;
  state?: MetricDisplayState;
  stateMessage?: string;
};

export type WinningContentItem = {
  id: string;
  title: string;
  channel: string;
  format: string | null;
  publishedAt: string | null;
  reach: number | null;
  engagements: number | null;
  engagementRate: number | null;
  profileVisits: number | null;
  clicks: number | null;
  baselineEngagementRate: number | null;
  engagementLift: number | null;
  profileVisitLift: number | null;
  clickLift: number | null;
  confidence: "low" | "medium" | "high";
  evidenceStrength: "emerging" | "moderate" | "strong";
  evidenceLabel: string;
  baselineDescription: string;
  sampleSize: number;
  comparisonWindow: string;
  disclaimer: string;
  theme: string | null;
  actions: Array<{ label: string; href: string }>;
};

export type OrganicOpportunityType =
  | "trending_topic"
  | "competitor_gap"
  | "winning_repurpose"
  | "format_opportunity"
  | "best_time"
  | "consistency_gap"
  | "underused_channel"
  | "conversation"
  | "content_theme"
  | "seo_to_social"
  | "social_to_seo";

export type OrganicOpportunity = {
  id: string;
  type: OrganicOpportunityType;
  title: string;
  finding: string;
  evidence: Array<{ label: string; value: string }>;
  confidence: "low" | "medium" | "high";
  potentialImpact: string;
  action: { label: string; href: string };
};

export type CommunityOpportunityStatus = "detected" | "reviewed" | "approved" | "dismissed" | "published";

export type CommunityOpportunity = {
  id: string;
  source: string;
  topic: string;
  relevance: "low" | "medium" | "high";
  audienceMatch: "low" | "medium" | "high";
  brandRelevance: "low" | "medium" | "high";
  intent: string | null;
  conversationUrl: string | null;
  suggestedAngle: string | null;
  status: CommunityOpportunityStatus;
  requiresHumanApproval: true;
};

export type ContentVariantLineage = {
  sourceContentId: string;
  variantOf?: string | null;
  provider: string;
  format: string;
};

export type ChannelVariantDraft = {
  provider: string;
  format: string;
  copy: string;
  title?: string;
  hook?: string;
  cta?: string;
  hashtags?: string[];
  mediaRequirements?: string[];
  lengthValidation?: { current: number; max: number | null; valid: boolean };
  status: "draft" | "pending_approval";
  lineage: ContentVariantLineage;
};

export type PublishingQueueStatus =
  | "draft"
  | "awaiting_approval"
  | "approved"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

export type OrganicPublishingQueueItem = {
  id: string;
  title: string;
  preview: string | null;
  channel: string;
  accountName: string;
  scheduledAt: string | null;
  campaign: string | null;
  status: PublishingQueueStatus;
  validationState: "valid" | "warning" | "error" | "pending";
  validationMessage: string | null;
  actions: Array<{ label: string; href: string }>;
};

export type BestTimeWindow = {
  channel: string;
  dayOfWeek: string;
  hourRange: string;
  engagementLift: number;
  confidence: "low" | "medium" | "high";
  sampleSize: number;
  actionLabel: string;
};

export type OrganicContentPerformanceItem = {
  id: string;
  title: string;
  channel: string;
  format: string | null;
  theme: string | null;
  campaign: string | null;
  publishedAt: string | null;
  reach: number | null;
  impressions: number | null;
  engagements: number | null;
  engagementRate: number | null;
  clicks: number | null;
  profileVisits: number | null;
  followsGained: number | null;
  conversionsInfluenced: number | null;
  status: string;
  sourceContentId: string | null;
  isWinning: boolean;
};

export type OrganicGrowthEngineData = {
  hasBrandContext: boolean;
  dateRange: {
    label: string;
    comparisonLabel: string;
    from: string;
    to: string;
  };
  freshness: { label: string; state: DataFreshnessState };
  coverage: string;
  partialCoverageNote: string | null;
  primaryCta: { label: string; href: string };
  executiveKpis: OrganicExecutiveKpi[];
  growthScore: OrganicGrowthScore;
  accounts: OrganicAccountRow[];
  priorities: Array<{
    id: string;
    title: string;
    urgency: "critical" | "high" | "normal";
    context: string;
    action: { label: string; href: string };
  }>;
  topOpportunity: OrganicOpportunity | null;
  winningContent: WinningContentItem[];
  opportunities: OrganicOpportunity[];
  contentPerformance: OrganicContentPerformanceItem[];
  publishingQueue: OrganicPublishingQueueItem[];
  consistencyGaps: Array<{ channel: string; message: string }>;
  bestTimeWindows: BestTimeWindow[];
  communityOpportunities: CommunityOpportunity[];
  insights: MarketingSignal[];
  channelMetrics: Array<{
    provider: string;
    label: string;
    reach: number | null;
    engagementRate: number | null;
    followersGained: number | null;
    clicks: number | null;
    connected: boolean;
  }>;
  providers: OrganicProviderDefinition[];
};
