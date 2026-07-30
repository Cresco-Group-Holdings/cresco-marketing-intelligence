import type { FunnelCountingMethod, FunnelStepRequirement, FunnelStepType } from "@prisma/client";

export type FunnelStepMatchingRules = {
  eventName?: string;
  pagePath?: string;
  pagePathContains?: string;
  conversionKey?: string;
  campaignId?: string;
  campaignName?: string;
  leadStatus?: string;
  crmStage?: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
};

export type FunnelStepDefinition = {
  id: string;
  stepOrder: number;
  name: string;
  stepType: FunnelStepType;
  matchingRules: FunnelStepMatchingRules;
  maxTimeToNextStepMs?: number | null;
  requirement: FunnelStepRequirement;
};

export type FunnelSubjectEvent = {
  subjectKey: string;
  occurredAt: Date;
  eventName?: string;
  pagePath?: string;
  sessionId?: string;
  identityId?: string;
  campaign?: string;
  channel?: string;
  provider?: string;
  landingPage?: string;
  device?: string;
  country?: string;
  isReturning?: boolean;
  audience?: string;
  contentKey?: string;
  leadStatus?: string;
  crmStage?: string;
  subscriptionStatus?: string;
  paymentStatus?: string;
  cohortDate?: string;
};

export type FunnelStepMetrics = {
  stepId: string;
  stepOrder: number;
  stepName: string;
  entrants: number;
  completions: number;
  stepConversion: number;
  cumulativeConversion: number;
  dropOffCount: number;
  dropOffRate: number;
  medianTimeToNextMs: number | null;
};

export type FunnelAnalysisInput = {
  steps: FunnelStepDefinition[];
  events: FunnelSubjectEvent[];
  countingMethod: FunnelCountingMethod;
  cohortDate?: Date;
};

export type FunnelAnalysisOutput = {
  entrants: number;
  totalConversions: number;
  stepResults: FunnelStepMetrics[];
  journeySamples: AnonymisedJourneySample[];
  dataQualityWarnings: string[];
};

export type AnonymisedJourneySample = {
  anonymisedId: string;
  stepsReached: number;
  completed: boolean;
  stepTimestamps: string[];
  segmentHints?: Record<string, string>;
};

export type FunnelInsight = {
  insightType: string;
  stepOrder?: number;
  stepName?: string;
  segmentDimension?: string;
  segmentValue?: string;
  metricValue?: number;
  evidence: Record<string, unknown>;
  message: string;
  severity: "info" | "warning" | "critical";
};
