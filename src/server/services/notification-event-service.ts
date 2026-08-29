import { DOMAIN_EVENT_TYPES } from "@/lib/domain-events/constants";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/constants";
import { domainEventService } from "@/server/services/domain-event-service";
import { notificationService } from "@/server/services/notification-service";
import { operationalAlertService } from "@/server/services/operational-alert-service";

/** High-level event emitter bridging domain failures to notifications + operational alerts. */
export const notificationEventService = {
  async publishingFailed(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    jobId: string;
    provider: string;
    safeError: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    await operationalAlertService.upsert({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      alertType: "PUBLISHING_FAILURE",
      category: "PUBLISHING",
      resourceType: "PublishingJob",
      resourceId: input.jobId,
      provider: input.provider,
      title: "Publishing failed",
      safeErrorMessage: input.safeError,
      recommendedAction: "Review the failure details and retry or reconnect the account.",
      idempotencyKey: input.idempotencyKey,
    });

    const notifications = await notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.PUBLISHING_FAILED,
      title: "Publishing failed",
      body: input.safeError,
      resourceType: "PublishingJob",
      resourceId: input.jobId,
      actionPath: `/operations/publishing`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
      priority: "HIGH",
    });

    await domainEventService.emit({
      type: DOMAIN_EVENT_TYPES.PUBLICATION_FAILED,
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      resourceType: "PublishingJob",
      resourceId: input.jobId,
      payload: {
        provider: input.provider,
        safeError: input.safeError,
        jobId: input.jobId,
      },
      idempotencyKey: `domain:${input.idempotencyKey}`,
    });

    return notifications;
  },

  async publishingSucceeded(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    jobId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    const notifications = await notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.PUBLISHING_SUCCEEDED,
      title: "Content published",
      body: "Your scheduled content was published successfully.",
      resourceType: "PublishingJob",
      resourceId: input.jobId,
      actionPath: `/content`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });

    await domainEventService.emit({
      type: DOMAIN_EVENT_TYPES.PUBLICATION_SUCCEEDED,
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      resourceType: "PublishingJob",
      resourceId: input.jobId,
      payload: { jobId: input.jobId },
      idempotencyKey: `domain:${input.idempotencyKey}`,
    });

    return notifications;
  },

  async tokenReauthRequired(input: {
    organisationId: string;
    brandId: string;
    connectionId: string;
    provider: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    await operationalAlertService.upsert({
      organisationId: input.organisationId,
      brandId: input.brandId,
      alertType: "TOKEN_REAUTH_REQUIRED",
      category: "CONNECTION",
      resourceType: "SocialConnection",
      resourceId: input.connectionId,
      provider: input.provider,
      title: "Reauthorisation required",
      safeErrorMessage: "A social connection requires reauthorisation.",
      recommendedAction: "Reconnect the account to restore publishing and sync.",
      idempotencyKey: input.idempotencyKey,
    });

    const notifications = await notificationService.emit({
      organisationId: input.organisationId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.TOKEN_REAUTH_REQUIRED,
      title: "Connection requires reauthorisation",
      body: `Your ${input.provider} connection needs to be reconnected.`,
      resourceType: "SocialConnection",
      resourceId: input.connectionId,
      actionPath: `/organic-social/accounts`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
      priority: "HIGH",
    });

    await domainEventService.emit({
      type: DOMAIN_EVENT_TYPES.PUBLICATION_REAUTH_REQUIRED,
      organisationId: input.organisationId,
      brandId: input.brandId,
      resourceType: "SocialConnection",
      resourceId: input.connectionId,
      payload: { provider: input.provider, connectionId: input.connectionId },
      idempotencyKey: `domain:${input.idempotencyKey}`,
    });

    return notifications;
  },

  async contentSubmittedForReview(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    contentId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.CONTENT_SUBMITTED_FOR_REVIEW,
      title: "Content submitted for review",
      body: "New content is waiting for approval.",
      resourceType: "ContentItem",
      resourceId: input.contentId,
      actionPath: `/content/${input.contentId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async contentApproved(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    contentId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.CONTENT_APPROVED,
      title: "Content approved",
      body: "Your content has been approved and is ready for scheduling.",
      resourceType: "ContentItem",
      resourceId: input.contentId,
      actionPath: `/content/${input.contentId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async contentChangesRequested(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    contentId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
    note?: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.CONTENT_CHANGES_REQUESTED,
      title: "Changes requested on content",
      body: input.note ?? "An approver requested changes before publication.",
      resourceType: "ContentItem",
      resourceId: input.contentId,
      actionPath: `/content/${input.contentId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async contentScheduled(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    contentId: string;
    scheduleId: string;
    scheduledFor: Date;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.CONTENT_SCHEDULED,
      title: "Content scheduled",
      body: `Content is scheduled for ${input.scheduledFor.toISOString()}.`,
      resourceType: "ContentSchedule",
      resourceId: input.scheduleId,
      actionPath: `/content/${input.contentId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async newQualifiedLead(input: {
    organisationId: string;
    projectId: string;
    brandId: string;
    leadId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      projectId: input.projectId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.NEW_QUALIFIED_LEAD,
      title: "New qualified lead",
      body: "A social enquiry has been qualified and needs follow-up.",
      resourceType: "MarketingLead",
      resourceId: input.leadId,
      actionPath: `/leads/${input.leadId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async syncFailed(input: {
    organisationId: string;
    brandId?: string;
    connectionId: string;
    provider: string;
    safeError: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.SYNC_FAILED,
      title: "Synchronisation failed",
      body: input.safeError,
      resourceType: "ProviderConnection",
      resourceId: input.connectionId,
      actionPath: `/integrations/${input.connectionId}`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
      priority: "HIGH",
    });
  },

  async publicationSucceeded(input: {
    organisationId: string;
    brandId: string;
    publicationId: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.PUBLICATION_SUCCEEDED,
      title: "Publication succeeded",
      body: "Your outbound publication completed successfully.",
      resourceType: "Publication",
      resourceId: input.publicationId,
      actionPath: `/publishing`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },

  async publicationFailed(input: {
    organisationId: string;
    brandId: string;
    publicationId: string;
    safeError: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.PUBLICATION_FAILED,
      title: "Publication failed",
      body: input.safeError,
      resourceType: "Publication",
      resourceId: input.publicationId,
      actionPath: `/publishing`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
      priority: "HIGH",
    });
  },

  async aiRecommendation(input: {
    organisationId: string;
    brandId: string;
    recommendationId: string;
    title: string;
    body: string;
    recipientUserIds: string[];
    idempotencyKey: string;
  }) {
    return notificationService.emit({
      organisationId: input.organisationId,
      brandId: input.brandId,
      eventType: NOTIFICATION_EVENT_TYPES.AI_RECOMMENDATION,
      title: input.title,
      body: input.body,
      resourceType: "GrowthRecommendation",
      resourceId: input.recommendationId,
      actionPath: `/growth`,
      recipientUserIds: input.recipientUserIds,
      idempotencyKey: input.idempotencyKey,
    });
  },
};
