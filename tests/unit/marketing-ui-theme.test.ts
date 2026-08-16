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
import { dashboardNavigationSections } from "@/components/navigation/dashboard-nav";

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
  it("groups paid and organic routes separately", () => {
    const paidSection = dashboardNavigationSections.find((section) => section.id === "paid-media");
    const organicSection = dashboardNavigationSections.find(
      (section) => section.id === "organic-social",
    );

    expect(paidSection?.items.some((item) => item.href === "/advertising")).toBe(true);
    expect(organicSection?.items.some((item) => item.href === "/social")).toBe(true);
    expect(organicSection?.items.some((item) => item.href === "/calendar" && !item.comingSoon)).toBe(
      true,
    );
  });

  it("does not mark calendar as coming soon", () => {
    const calendarItem = dashboardNavigationSections
      .flatMap((section) => section.items)
      .find((item) => item.href === "/calendar");

    expect(calendarItem?.comingSoon).toBeFalsy();
  });
});
