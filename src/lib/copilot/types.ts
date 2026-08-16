import type { AttributionModelType } from "@prisma/client";

export type CopilotModule =
  | "dashboard"
  | "advertising"
  | "social"
  | "content"
  | "analytics"
  | "calendar"
  | "copilot"
  | "other";

export type CopilotIntent =
  | "performance"
  | "diagnosis"
  | "comparison"
  | "budget"
  | "content"
  | "organic"
  | "paid"
  | "attribution"
  | "revenue"
  | "conversion"
  | "publishing"
  | "planning"
  | "data-quality"
  | "priorities"
  | "brief"
  | "general";

export type CopilotConfidenceLevel =
  | "high"
  | "moderate"
  | "limited"
  | "insufficient";

export type CopilotPageContext = {
  route: string;
  module: CopilotModule;
  entityType?: string;
  entityId?: string;
  dateRange?: {
    preset?: string;
    from?: string;
    to?: string;
    comparison?: string;
  };
  attributionModel?: AttributionModelType | string;
  activeFilters?: Record<string, unknown>;
};

export type EvidenceItem = {
  id: string;
  label: string;
  metric?: string;
  value?: number | string;
  previousValue?: number | string;
  source?: string;
  dateRange?: { from: string; to: string };
  entityType?: string;
  entityId?: string;
  entityHref?: string;
  freshness?: string;
  coverage?: number | null;
  sampleSize?: number | null;
  limitations?: string[];
};

export type CopilotFact = {
  id: string;
  statement: string;
  evidenceIds: string[];
};

export type CopilotInference = {
  id: string;
  statement: string;
  evidenceIds: string[];
};

export type CopilotRecommendation = {
  id: string;
  statement: string;
  evidenceIds: string[];
};

export type CopilotSuggestedAction = {
  id: string;
  type: "navigate" | "open_entity" | "create_draft" | "prepare_plan";
  label: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  requiresConfirmation?: boolean;
};

export type CopilotConfidence = {
  level: CopilotConfidenceLevel;
  label: string;
  reasons: string[];
};

export type CopilotResponse = {
  answer: string;
  facts: CopilotFact[];
  inferences: CopilotInference[];
  recommendations: CopilotRecommendation[];
  evidence: EvidenceItem[];
  confidence: CopilotConfidence;
  suggestedActions: CopilotSuggestedAction[];
  followUpQuestions: string[];
  limitations: string[];
  intent: CopilotIntent;
  outputSource: "deterministic" | "ai" | "hybrid";
  briefSections?: Array<{ title: string; items: string[] }>;
};

export type CopilotToolName =
  | "getMarketingOverview"
  | "getPaidPerformance"
  | "getCampaignPerformance"
  | "getCreativePerformance"
  | "getOrganicPerformance"
  | "getContentPerformance"
  | "getPublishingSchedule"
  | "getAttributionSummary"
  | "getRevenueAnalytics"
  | "getDataCoverage"
  | "getMarketingSignals";

export type CopilotToolResult<T = unknown> = {
  data: T;
  evidence: EvidenceItem[];
  freshness?: string;
  coverage?: number | null;
  limitations?: string[];
  sampleSize?: number | null;
  truncated?: boolean;
};

export type CopilotQueryInput = {
  question: string;
  conversationId?: string;
  pageContext: CopilotPageContext;
};

export type CopilotMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CopilotResponse;
  createdAt: string;
};

export type CopilotConversationRecord = {
  id: string;
  title: string;
  messages: CopilotMessageRecord[];
  createdAt: string;
  updatedAt: string;
};
