export type PriorityUrgency = "critical" | "high" | "normal";
export type PriorityType =
  | "approval"
  | "integration"
  | "publication"
  | "content"
  | "automation"
  | "experiment"
  | "anomaly"
  | "data";

export type CommandCentrePriority = {
  id: string;
  type: PriorityType;
  title: string;
  urgency: PriorityUrgency;
  context: string;
  targetLabel?: string;
  action: {
    label: string;
    href: string;
  };
};

export type CommandCentreActivity = {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  href?: string;
};

export type CommandCentreFunnelStage = {
  stage: string;
  count: number | null;
  rateLabel?: string;
  rateValue?: string;
  availability?: "available" | "zero" | "unavailable" | "not_tracked";
};

export type ChannelPerformanceMetric = "spend" | "roas" | "conversions" | "ctr";

export type OrganicChannelPerformanceMetric =
  | "reach"
  | "engagement"
  | "engagementRate"
  | "followersGained";

export type ChannelPerformanceMode = "paid" | "organic";

export type MetricDisplayState = "loading" | "empty" | "partial" | "stale" | "normal";

export type CommandCentreChannelRow = {
  key: string;
  label: string;
  provider: string;
  accountLabel?: string;
  connected: boolean;
  metricValue: string;
  change: number | null;
  comparisonLabel?: string;
  status: "healthy" | "warning" | "error" | "disconnected";
  relativePerformance: number;
  href: string;
  connectHref?: string;
  actionLabel?: string;
};

export type SparklinePoint = {
  value: number;
};
