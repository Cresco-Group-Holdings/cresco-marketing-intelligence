import type { DataFreshnessState } from "@/lib/marketing-intelligence/types";

export type OrganicConnectionState =
  | "Connected"
  | "Needs re-authentication"
  | "Permission missing"
  | "Sync delayed"
  | "Disconnected"
  | "Unavailable";

export type OrganicPerformanceState =
  | "Strong"
  | "Healthy"
  | "Needs attention"
  | "Insufficient data";

export type ContentPipelineStatus =
  | "Idea"
  | "Draft"
  | "In Review"
  | "Ready"
  | "Scheduled"
  | "Publishing"
  | "Published"
  | "Failed"
  | "Archived";

export type PublishingQueueSection = "Ready" | "Scheduled" | "Publishing" | "Published" | "Failed";

export type OrganicChannelMetrics = {
  provider: string;
  channel: string;
  connectionState: OrganicConnectionState;
  connected: boolean;
  reach: number | null;
  impressions: number | null;
  views: number | null;
  engagement: number | null;
  engagementRate: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  followers: number | null;
  followerGrowth: number | null;
  publishedContent: number;
  scheduledContent: number;
  reelsPublished: number | null;
  freshness: DataFreshnessState;
  freshnessLabel: string;
  unavailableMetrics: string[];
  ctaLabel: string;
  ctaHref: string;
  connectHref: string;
};

export type FormatPerformanceItem = {
  format: string;
  contentCount: number;
  averageReach: number | null;
  averageEngagement: number | null;
  engagementRate: number | null;
  averageViews: number | null;
};

export type OrganicContentItem = {
  id: string;
  title: string;
  format: string | null;
  channel: string | null;
  status: ContentPipelineStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  reach: number | null;
  engagement: number | null;
  performanceState: OrganicPerformanceState;
};

export type ReelItem = {
  id: string;
  title: string;
  duration: string | null;
  channels: string[];
  captionStatus: "Complete" | "Draft" | "Missing";
  publishingStatus: ContentPipelineStatus;
  scheduledAt: string | null;
  views: number | null;
  engagement: number | null;
  shares: number | null;
  saves: number | null;
  performanceState: OrganicPerformanceState;
  fatigueDetected: boolean;
};

export type PublishingQueueItem = {
  id: string;
  title: string;
  channel: string;
  brand: string;
  section: PublishingQueueSection;
  scheduledAt: string | null;
  failureReason: string | null;
  canRetry: boolean;
  previewHref: string | null;
};

export type ConsistencyChannelScore = {
  channel: string;
  label: string;
  score: number;
};

export type PostingWindowInsight = {
  channel: string;
  format: string;
  dayOfWeek: string;
  hourRange: string;
  engagementLift: number;
  sampleSize: number;
};

export type ScheduleGap = {
  channel: string;
  message: string;
};

export type OrganicSocialWorkspaceData = {
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
  executiveKpis: Array<{
    label: string;
    value: string;
    change: number | null;
    comparisonLabel: string;
    footnote?: string;
  }>;
  channels: OrganicChannelMetrics[];
  chart: Record<string, Array<{ label: string; value: number }>>;
  formatPerformance: FormatPerformanceItem[];
  topContent: OrganicContentItem[];
  lowPerformingContent: OrganicContentItem[];
  contentPipeline: Array<{ status: ContentPipelineStatus; count: number }>;
  reels: {
    drafts: ReelItem[];
    ready: ReelItem[];
    scheduled: ReelItem[];
    published: ReelItem[];
    topPerforming: ReelItem[];
  };
  publishingQueue: PublishingQueueItem[];
  consistency: {
    score: number;
    channels: ConsistencyChannelScore[];
  };
  scheduleGaps: ScheduleGap[];
  postingWindows: PostingWindowInsight[];
  publishRecommendation: {
    format: string;
    channel: string;
    reason: string;
  } | null;
  insights: import("@/lib/marketing-intelligence/types").MarketingSignal[];
};
