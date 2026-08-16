import { prisma } from "@/lib/database/prisma";
import {
  DEFAULT_APPEARANCE,
  isValidBackgroundStyle,
  isValidThemeMode,
  normaliseBackgroundForMode,
  type AppearancePreferences,
} from "@/lib/theme/types";

function toAppearancePreference(
  preference: { themeMode: string | null; backgroundStyle: string | null } | null,
): AppearancePreferences {
  if (!preference) {
    return DEFAULT_APPEARANCE;
  }

  const themeMode = isValidThemeMode(preference.themeMode)
    ? preference.themeMode
    : DEFAULT_APPEARANCE.themeMode;
  const backgroundStyle = isValidBackgroundStyle(preference.backgroundStyle)
    ? preference.backgroundStyle
    : DEFAULT_APPEARANCE.backgroundStyle;

  return {
    themeMode,
    backgroundStyle: normaliseBackgroundForMode(themeMode, backgroundStyle),
  };
}

export const appearanceService = {
  async getAppearance(userProfileId: string): Promise<AppearancePreferences> {
    const preference = await prisma.workspacePreference.findUnique({
      where: { userId: userProfileId },
      select: {
        themeMode: true,
        backgroundStyle: true,
      },
    });

    return toAppearancePreference(preference);
  },

  async updateAppearance(
    userProfileId: string,
    appearance: AppearancePreferences,
  ): Promise<AppearancePreferences> {
    const normalised = {
      themeMode: appearance.themeMode,
      backgroundStyle: normaliseBackgroundForMode(
        appearance.themeMode,
        appearance.backgroundStyle,
      ),
    };

    await prisma.workspacePreference.upsert({
      where: { userId: userProfileId },
      create: {
        userId: userProfileId,
        themeMode: normalised.themeMode,
        backgroundStyle: normalised.backgroundStyle,
      },
      update: {
        themeMode: normalised.themeMode,
        backgroundStyle: normalised.backgroundStyle,
      },
    });

    return normalised;
  },
};
