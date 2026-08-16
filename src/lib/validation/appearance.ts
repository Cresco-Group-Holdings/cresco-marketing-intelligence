import { z } from "zod";
import {
  isValidBackgroundStyle,
  isValidThemeMode,
  normaliseBackgroundForMode,
  type AppearancePreferences,
} from "@/lib/theme/types";

export const appearanceUpdateSchema = z.object({
  themeMode: z.string().refine(isValidThemeMode, "Invalid theme mode."),
  backgroundStyle: z.string().refine(isValidBackgroundStyle, "Invalid background style."),
});

export function normaliseAppearanceInput(input: {
  themeMode: string;
  backgroundStyle: string;
}): AppearancePreferences {
  const themeMode = isValidThemeMode(input.themeMode) ? input.themeMode : "light";
  const backgroundStyle = isValidBackgroundStyle(input.backgroundStyle)
    ? input.backgroundStyle
    : "beige";

  return {
    themeMode,
    backgroundStyle: normaliseBackgroundForMode(themeMode, backgroundStyle),
  };
}
