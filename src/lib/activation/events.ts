export const ACTIVATION_EVENT_NAMES = [
  "signup_complete",
  "organisation_created",
  "project_created",
  "brand_created",
  "brand_minimum_ready",
  "provider_connection_started",
  "provider_connected",
  "initial_sync_complete",
  "first_ai_brief",
  "first_master_content",
  "first_variant",
  "first_publication_scheduled",
  "first_publication_published",
  "first_analytics_view",
  "first_recommendation_view",
  "activation_complete",
  "demo_workspace_entered",
  "demo_workspace_exited",
  "onboarding_resumed",
  "onboarding_goal_selected",
] as const;

export type ActivationEventName = (typeof ACTIVATION_EVENT_NAMES)[number];

export type ActivationEventPayload = {
  event: ActivationEventName;
  organisationId?: string;
  projectId?: string;
  brandId?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export const ACTIVATION_AUDIT_ACTION_PREFIX = "activation.";

export function activationAuditAction(event: ActivationEventName): string {
  return `${ACTIVATION_AUDIT_ACTION_PREFIX}${event}`;
}

export function isActivationAuditAction(action: string): boolean {
  return action.startsWith(ACTIVATION_AUDIT_ACTION_PREFIX);
}

export function parseActivationAuditAction(action: string): ActivationEventName | null {
  if (!isActivationAuditAction(action)) {
    return null;
  }

  const event = action.slice(ACTIVATION_AUDIT_ACTION_PREFIX.length) as ActivationEventName;
  return ACTIVATION_EVENT_NAMES.includes(event) ? event : null;
}
