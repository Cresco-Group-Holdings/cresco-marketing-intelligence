import { describe, expect, it } from "vitest";
import {
  CLIENT_BEHAVIORAL_EVENTS,
  CLIENT_DOMAIN_ASSERTING_EVENTS,
  isClientDomainAssertingEvent,
} from "@/lib/activation/truth";

describe("activation truth model", () => {
  it("classifies domain-asserting events", () => {
    expect(isClientDomainAssertingEvent("first_publication_scheduled")).toBe(true);
    expect(isClientDomainAssertingEvent("provider_connected")).toBe(true);
    expect(isClientDomainAssertingEvent("first_analytics_view")).toBe(false);
  });

  it("keeps behavioural and domain event lists disjoint", () => {
    const overlap = CLIENT_BEHAVIORAL_EVENTS.filter((event) =>
      (CLIENT_DOMAIN_ASSERTING_EVENTS as readonly string[]).includes(event),
    );
    expect(overlap).toEqual([]);
  });
});
