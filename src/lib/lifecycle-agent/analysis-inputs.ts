export type LifecycleAnalysisInput = {
  analysisDate: Date;
  dateRangeStart: Date;
  dateRangeEnd: Date;
  brandId: string;
  organisationId: string;
  projectId?: string;
  scope: {
    leadIds?: string[];
    opportunityIds?: string[];
    pipelineId?: string;
    lifecycleStages?: string[];
    ownerUserId?: string;
  };
  leads: Array<{
    id: string;
    status: string;
    lifecycleStage: string;
    ownerUserId: string | null;
    lastActivityAt: Date | null;
    createdAt: Date;
    qualificationState?: string;
    leadScore?: number;
    purchaseLikelihoodEstimate?: number;
    churnLikelihoodEstimate?: number;
    suppressed?: boolean;
    unsubscribed?: boolean;
    consentGranted?: boolean;
    marketingConsent?: boolean;
    openTaskCount?: number;
    overdueTaskCount?: number;
  }>;
  opportunities: Array<{
    id: string;
    name: string;
    status: string;
    stageCategory?: string;
    pipelineStage?: string;
    ownerUserId: string | null;
    expectedValue?: number;
    probability?: number;
    expectedCloseDate?: Date | null;
    lastActivityAt?: Date | null;
    stageEnteredAt?: Date | null;
    maxDurationDays?: number | null;
    nextAction?: string | null;
    trialEndsAt?: Date | null;
    renewalDate?: Date | null;
    hasDecisionMaker?: boolean;
    stageReversalCount?: number;
    overdueTaskCount?: number;
    openTaskCount?: number;
  }>;
  activities: Array<{
    id: string;
    leadId?: string;
    opportunityId?: string;
    type: string;
    summary?: string | null;
    occurredAt: Date;
  }>;
  tasks: Array<{
    id: string;
    leadId?: string;
    opportunityId?: string;
    title: string;
    taskTypeCode: string;
    status: string;
    dueDate: Date | null;
    ownerUserId?: string | null;
  }>;
  dataQuality: {
    freshnessHours: number | null;
    activityCount: number;
    hasOwnerCoverage: boolean;
    warnings?: string[];
  };
  consentContext?: {
    marketingConsentRequired: boolean;
    outreachAllowed: boolean;
    restrictedChannels?: string[];
  };
  metricDefinitions?: Record<string, string>;
  userNotes?: string;
  briefType?: string;
};
