import { describe, expect, it } from "vitest";
import {
  buildConnectionHealthView,
  connectionHealthLabel,
  mapConnectionStatusToHealthState,
  summarizeProviderConnectionHealthCounts,
} from "@/lib/providers/connection-health";

describe("connection health", () => {
  it("maps reauth statuses separately from not connected", () => {
    expect(mapConnectionStatusToHealthState("REAUTH_REQUIRED")).toBe("reauthentication_required");
    expect(mapConnectionStatusToHealthState("DRAFT")).toBe("connecting");
    expect(connectionHealthLabel("reauthentication_required")).toBe("Reauthentication required");
  });

  it("shows initial sync when flagged", () => {
    expect(
      mapConnectionStatusToHealthState("CONNECTED", {
        hasSelectedAccount: true,
        initialSyncInProgress: true,
      }),
    ).toBe("initial_sync");
  });

  it("builds a health view with freshness", () => {
    const view = buildConnectionHealthView({
      status: "CONNECTED",
      hasSelectedAccount: true,
      lastSuccessfulSyncAt: "2026-01-01T00:00:00.000Z",
    });
    expect(view.state).toBe("healthy");
    expect(view.freshness).toBe("current");
    expect(view.reconnectRequired).toBe(false);
  });

  it("summarizes reauth and initial sync counts from canonical health states", () => {
    const summary = summarizeProviderConnectionHealthCounts([
      { status: "REAUTH_REQUIRED", hasSelectedAccount: true },
      { status: "EXPIRED" },
      {
        status: "CONNECTED",
        hasSelectedAccount: true,
        initialSyncInProgress: true,
      },
      { status: "CONNECTED", hasSelectedAccount: true },
    ]);

    expect(summary.reauthRequired).toBe(2);
    expect(summary.initialSyncInProgress).toBe(1);
  });
});
