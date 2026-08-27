import type { ActivationEventName } from "@/lib/activation/events";

/**
 * Activation truth model
 *
 * Domain milestones are derived exclusively from server-verifiable product state
 * (database records). Product analytics events record behavioural instrumentation
 * only and must never be treated as proof that a domain object exists.
 *
 * Activated: workspace foundation + brand knowledge + data source + at least one
 * core value action (AI content, publication, analytics observation, or insight).
 *
 * Completed: activated AND all essential checklist steps are complete in the real
 * workspace (demo mode does not inflate completion).
 */

/** Events that assert server-side domain state — rejected from client POST. */
export const CLIENT_DOMAIN_ASSERTING_EVENTS = [
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
  "activation_complete",
] as const satisfies readonly ActivationEventName[];

export type ClientDomainAssertingEvent = (typeof CLIENT_DOMAIN_ASSERTING_EVENTS)[number];

/** Behavioural events allowed from the client activation events API. */
export const CLIENT_BEHAVIORAL_EVENTS = [
  "signup_complete",
  "first_analytics_view",
  "first_recommendation_view",
  "onboarding_resumed",
  "onboarding_goal_selected",
  "demo_workspace_entered",
  "demo_workspace_exited",
] as const satisfies readonly ActivationEventName[];

export function isClientDomainAssertingEvent(
  event: ActivationEventName,
): event is ClientDomainAssertingEvent {
  return (CLIENT_DOMAIN_ASSERTING_EVENTS as readonly string[]).includes(event);
}

export function isClientBehavioralEvent(event: ActivationEventName): boolean {
  return (CLIENT_BEHAVIORAL_EVENTS as readonly string[]).includes(event);
}

/** Events that should be deduplicated per organisation (idempotent recording). */
export const IDEMPOTENT_ACTIVATION_EVENTS: ActivationEventName[] = [
  "first_analytics_view",
  "first_recommendation_view",
  "activation_complete",
  "demo_workspace_entered",
  "demo_workspace_exited",
  "onboarding_goal_selected",
];
