export type ThemeMode = "dark" | "light";

export type DarkBackgroundStyle = "charcoal" | "graphite";
export type LightBackgroundStyle = "beige" | "warm-ivory" | "neutral";

export type BackgroundStyle = DarkBackgroundStyle | LightBackgroundStyle;

export type AppearancePreferences = {
  themeMode: ThemeMode;
  backgroundStyle: BackgroundStyle;
};

export const THEME_STORAGE_KEY = "cresco-appearance";

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  themeMode: "light",
  backgroundStyle: "beige",
};

export const DARK_BACKGROUNDS: DarkBackgroundStyle[] = ["charcoal", "graphite"];
export const LIGHT_BACKGROUNDS: LightBackgroundStyle[] = ["beige", "warm-ivory", "neutral"];

export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light";
}

export function isValidBackgroundStyle(value: unknown): value is BackgroundStyle {
  return (
    value === "charcoal" ||
    value === "graphite" ||
    value === "beige" ||
    value === "warm-ivory" ||
    value === "neutral"
  );
}

export function getDefaultBackgroundForMode(mode: ThemeMode): BackgroundStyle {
  return mode === "dark" ? "graphite" : "beige";
}

export function normaliseBackgroundForMode(
  mode: ThemeMode,
  style: BackgroundStyle,
): BackgroundStyle {
  if (mode === "dark") {
    return DARK_BACKGROUNDS.includes(style as DarkBackgroundStyle)
      ? (style as DarkBackgroundStyle)
      : "graphite";
  }
  return LIGHT_BACKGROUNDS.includes(style as LightBackgroundStyle)
    ? (style as LightBackgroundStyle)
    : "beige";
}

export function getAppearanceDataAttributes(
  appearance: AppearancePreferences,
): Record<string, string> {
  return {
    "data-theme": appearance.themeMode,
    "data-background": appearance.backgroundStyle,
  };
}
