import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  DEFAULT_APPEARANCE,
  normaliseBackgroundForMode,
  type AppearancePreferences,
} from "@/lib/theme/types";
import {
  readAppearanceFromStorage,
  resolveInitialAppearance,
  writeAppearanceToStorage,
} from "@/lib/theme/storage";
import { normaliseAppearanceInput } from "@/lib/validation/appearance";
import {
  dashboardNavigation,
  dashboardNavigationSections,
  secondaryNavigation,
} from "@/components/navigation/dashboard-nav";
import { buildCommandCentrePriorities } from "@/lib/command-centre/priorities";
import { buildChannelPerformanceRows, buildFunnelStages, extractSparkline } from "@/lib/command-centre/metrics";
import {
  readCollapsedSections,
  readSidebarCollapsed,
  writeCollapsedSections,
  writeSidebarCollapsed,
} from "@/lib/navigation/sidebar-state";

describe("theme types", () => {
  it("normalises dark backgrounds for dark mode", () => {
    expect(normaliseBackgroundForMode("dark", "beige")).toBe("graphite");
    expect(normaliseBackgroundForMode("dark", "charcoal")).toBe("charcoal");
  });

  it("normalises light backgrounds for light mode", () => {
    expect(normaliseBackgroundForMode("light", "charcoal")).toBe("beige");
    expect(normaliseBackgroundForMode("light", "warm-ivory")).toBe("warm-ivory");
  });
});

describe("theme storage", () => {
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("writes and reads appearance preferences", () => {
    const appearance: AppearancePreferences = {
      themeMode: "dark",
      backgroundStyle: "charcoal",
    };
    writeAppearanceToStorage(appearance);
    expect(readAppearanceFromStorage()).toEqual(appearance);
  });

  it("resolves server preference over stored preference", () => {
    writeAppearanceToStorage({
      themeMode: "light",
      backgroundStyle: "beige",
    });

    const resolved = resolveInitialAppearance(readAppearanceFromStorage(), {
      themeMode: "dark",
      backgroundStyle: "graphite",
    });

    expect(resolved).toEqual({
      themeMode: "dark",
      backgroundStyle: "graphite",
    });
  });

  it("falls back to defaults when nothing is stored", () => {
    expect(resolveInitialAppearance(null, null)).toEqual(DEFAULT_APPEARANCE);
  });

  it("persists sidebar collapse state", () => {
    expect(readSidebarCollapsed()).toBe(false);
    writeSidebarCollapsed(true);
    expect(readSidebarCollapsed()).toBe(true);
  });

  it("persists collapsed navigation sections", () => {
    writeCollapsedSections({ execute: true });
    expect(readCollapsedSections()).toEqual({ execute: true });
  });
});

describe("appearance validation", () => {
  it("normalises valid appearance input", () => {
    expect(
      normaliseAppearanceInput({
        themeMode: "light",
        backgroundStyle: "neutral",
      }),
    ).toEqual({
      themeMode: "light",
      backgroundStyle: "neutral",
    });
  });
});

describe("dashboard navigation", () => {
  it("follows the Command / Execute / Strategy / Measure / Intelligence / System hierarchy", () => {
    expect(dashboardNavigationSections.map((section) => section.id)).toEqual([
      "command",
      "execute",
      "strategy",
      "measure",
      "intelligence",
      "system",
    ]);
  });

  it("places Command Centre and Activity under Command", () => {
    const command = dashboardNavigationSections.find((section) => section.id === "command");
    expect(command?.items.map((item) => item.href)).toEqual(["/dashboard", "/operations"]);
  });

  it("keeps legacy campaigns route accessible via secondary navigation", () => {
    expect(secondaryNavigation.some((item) => item.href === "/campaigns")).toBe(true);
  });

  it("does not mark calendar as coming soon", () => {
    const calendarItem = dashboardNavigation.find((item) => item.href === "/calendar");
    expect(calendarItem?.comingSoon).toBeFalsy();
  });

  it("groups execute routes for advertising and organic social", () => {
    const execute = dashboardNavigationSections.find((section) => section.id === "execute");
    expect(execute?.items.some((item) => item.href === "/advertising")).toBe(true);
    expect(execute?.items.some((item) => item.href === "/organic-social")).toBe(true);
    expect(execute?.items.some((item) => item.href === "/content")).toBe(true);
  });
});

describe("command centre metrics", () => {
  it("builds funnel stages only from available data", () => {
    const stages = buildFunnelStages({
      impressions: 1000,
      clicks: 100,
      visits: null,
      conversions: 10,
      revenue: 500,
    });

    expect(stages.map((stage) => stage.stage)).toEqual([
      "Impressions",
      "Clicks",
      "Conversions",
      "Revenue",
    ]);
    expect(stages[1]?.rateValue).toBe("10.00%");
  });

  it("extracts sparkline points from series data", () => {
    expect(extractSparkline([{ value: 1 }, { value: 2 }, { value: 3 }])).toEqual([1, 2, 3]);
  });

  it("builds channel rows without fabricating disconnected provider metrics", () => {
    const rows = buildChannelPerformanceRows(
      [
        {
          provider: "Google Ads",
          spend: 100,
          conversions: 5,
          revenue: 250,
          clicks: 20,
          impressions: 1000,
        },
      ],
      [
        {
          key: "GOOGLE_ADS",
          label: "Google Ads",
          href: "/advertising/google",
          connectHref: "/connectors/google-ads",
          connected: true,
        },
        {
          key: "META",
          label: "Meta Ads",
          href: "/advertising/meta",
          connectHref: "/connectors/meta-ads",
          connected: false,
        },
      ],
      "spend",
      "GBP",
    );

    expect(rows[0]?.metricValue).toContain("100");
    expect(rows[0]?.status).toBe("healthy");
    expect(rows[1]?.status).toBe("disconnected");
    expect(rows[1]?.metricValue).toBe("—");
  });
});

describe("command centre priorities", () => {
  it("ranks integration and approval priorities by urgency", () => {
    const priorities = buildCommandCentrePriorities({
      pendingApprovals: 2,
      approvalBudget: "£7,450 budget",
      openAlerts: [
        {
          id: "a1",
          title: "Meta integration issue",
          alertType: "CONNECTOR_SYNC_FAILURE",
          provider: "META",
          safeErrorMessage: "Data stale for 6 hours",
          updatedAt: new Date(),
        },
      ],
      dueTodayPublications: 3,
      overdueContent: 0,
      failedAutomations: 0,
      experimentsReady: 0,
      staleDataProviders: [],
    });

    expect(priorities[0]?.urgency).toBe("critical");
    expect(priorities.some((item) => item.type === "approval")).toBe(true);
  });

  it("returns empty priorities when nothing needs attention", () => {
    expect(
      buildCommandCentrePriorities({
        pendingApprovals: 0,
        openAlerts: [],
        dueTodayPublications: 0,
        overdueContent: 0,
        failedAutomations: 0,
        experimentsReady: 0,
        staleDataProviders: [],
      }),
    ).toEqual([]);
  });
});
