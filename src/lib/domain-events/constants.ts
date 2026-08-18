/** Canonical domain event types emitted after authoritative state persistence. */
export const DOMAIN_EVENT_TYPES = {
  PUBLICATION_SUCCEEDED: "publication.succeeded",
  PUBLICATION_FAILED: "publication.failed",
  PUBLICATION_REAUTH_REQUIRED: "publication.reauth_required",
  CAMPAIGN_CREATED: "campaign.created",
  CAMPAIGN_PERFORMANCE_CHANGED: "campaign.performance_changed",
  CONTENT_CREATED: "content.created",
  CONTENT_APPROVED: "content.approved",
  LEAD_CREATED: "lead.created",
  LEAD_QUALIFIED: "lead.qualified",
  OPPORTUNITY_CHANGED: "opportunity.changed",
  PROVIDER_SYNC_FAILED: "provider.sync_failed",
  ANALYTICS_UPDATED: "analytics.updated",
  BUDGET_THRESHOLD_REACHED: "budget.threshold_reached",
} as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[keyof typeof DOMAIN_EVENT_TYPES];

export type DomainEvent = {
  type: DomainEventType;
  organisationId: string;
  projectId?: string;
  brandId: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string;
  occurredAt?: Date;
  actorUserId?: string;
};
