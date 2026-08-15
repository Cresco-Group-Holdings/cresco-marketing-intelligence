import { AUTOMATION_EVENT_TYPES, type AutomationEventType } from "./constants";

export function isValidEventType(value: string): value is AutomationEventType {
  return (AUTOMATION_EVENT_TYPES as readonly string[]).includes(value);
}

export function matchesEventTrigger(
  triggerEventType: AutomationEventType | null | undefined,
  incomingEventType: AutomationEventType,
): boolean {
  if (!triggerEventType) return false;
  if (triggerEventType === "MANUAL") return incomingEventType === "MANUAL";
  return triggerEventType === incomingEventType;
}

export function buildEventPayload(
  eventType: AutomationEventType,
  resource: Record<string, unknown>,
): Record<string, unknown> {
  return {
    event: { type: eventType, resourceType: resource.resourceType, resourceId: resource.resourceId },
    ...resource,
  };
}
