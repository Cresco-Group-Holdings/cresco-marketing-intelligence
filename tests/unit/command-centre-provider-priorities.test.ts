import { describe, expect, it } from "vitest";
import { buildCommandCentrePriorities } from "@/lib/command-centre/priorities";

describe("command centre provider health priorities", () => {
  it("surfaces reauthentication as critical priority", () => {
    const priorities = buildCommandCentrePriorities({
      pendingApprovals: 0,
      openAlerts: [],
      dueTodayPublications: 0,
      overdueContent: 0,
      failedAutomations: 0,
      experimentsReady: 0,
      staleDataProviders: [],
      providerReauthRequired: 2,
    });

    const reauth = priorities.find((item) => item.id === "provider-reauth-required");
    expect(reauth?.urgency).toBe("critical");
  });

  it("treats initial sync as normal priority", () => {
    const priorities = buildCommandCentrePriorities({
      pendingApprovals: 0,
      openAlerts: [],
      dueTodayPublications: 0,
      overdueContent: 0,
      failedAutomations: 0,
      experimentsReady: 0,
      staleDataProviders: [],
      providerInitialSyncInProgress: 1,
    });

    const initialSync = priorities.find((item) => item.id === "provider-initial-sync");
    expect(initialSync?.urgency).toBe("normal");
  });

  it("surfaces stale providers without duplicating reauth alerts", () => {
    const priorities = buildCommandCentrePriorities({
      pendingApprovals: 0,
      openAlerts: [],
      dueTodayPublications: 0,
      overdueContent: 0,
      failedAutomations: 0,
      experimentsReady: 0,
      staleDataProviders: ["linkedin"],
      providerReauthRequired: 0,
    });

    expect(priorities.some((item) => item.id === "stale-linkedin")).toBe(true);
    expect(priorities.filter((item) => item.id === "provider-reauth-required")).toHaveLength(0);
  });

  it("does not create provider priority noise when healthy", () => {
    const priorities = buildCommandCentrePriorities({
      pendingApprovals: 0,
      openAlerts: [],
      dueTodayPublications: 0,
      overdueContent: 0,
      failedAutomations: 0,
      experimentsReady: 0,
      staleDataProviders: [],
      providerReauthRequired: 0,
      providerInitialSyncInProgress: 0,
    });

    expect(priorities.some((item) => item.id.startsWith("provider-"))).toBe(false);
  });
});
