import {
  DEFAULT_APPEARANCE,
  isValidBackgroundStyle,
  isValidThemeMode,
  normaliseBackgroundForMode,
  THEME_STORAGE_KEY,
  type AppearancePreferences,
} from "@/lib/theme/types";

export function readAppearanceFromStorage(): AppearancePreferences | null {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  try {
    const raw = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    if (!isValidThemeMode(parsed.themeMode)) {
      return null;
    }

    const backgroundStyle = isValidBackgroundStyle(parsed.backgroundStyle)
      ? parsed.backgroundStyle
      : DEFAULT_APPEARANCE.backgroundStyle;

    return {
      themeMode: parsed.themeMode,
      backgroundStyle: normaliseBackgroundForMode(parsed.themeMode, backgroundStyle),
    };
  } catch {
    return null;
  }
}

export function writeAppearanceToStorage(appearance: AppearancePreferences): void {
  if (typeof globalThis.localStorage === "undefined") {
    return;
  }

  globalThis.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(appearance));
}

export function resolveInitialAppearance(
  stored: AppearancePreferences | null,
  server: AppearancePreferences | null,
): AppearancePreferences {
  const candidate = server ?? stored ?? DEFAULT_APPEARANCE;
  return {
    themeMode: candidate.themeMode,
    backgroundStyle: normaliseBackgroundForMode(candidate.themeMode, candidate.backgroundStyle),
  };
}
