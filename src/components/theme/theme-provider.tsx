"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api/client";
import {
  getAppearanceDataAttributes,
  normaliseBackgroundForMode,
  type AppearancePreferences,
  type BackgroundStyle,
  type ThemeMode,
} from "@/lib/theme/types";
import {
  readAppearanceFromStorage,
  resolveInitialAppearance,
  writeAppearanceToStorage,
} from "@/lib/theme/storage";

type AppearanceApiResponse = {
  appearance: AppearancePreferences;
};

type ThemeContextValue = {
  appearance: AppearancePreferences;
  setThemeMode: (mode: ThemeMode) => void;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  setAppearance: (appearance: AppearancePreferences) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyAppearanceToDocument(appearance: AppearancePreferences) {
  const attributes = getAppearanceDataAttributes(appearance);
  const root = document.documentElement;
  root.setAttribute("data-theme", attributes["data-theme"] ?? appearance.themeMode);
  root.setAttribute("data-background", attributes["data-background"] ?? appearance.backgroundStyle);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearancePreferences>(() =>
    resolveInitialAppearance(readAppearanceFromStorage(), null),
  );

  const persistAppearance = useCallback(async (next: AppearancePreferences) => {
    writeAppearanceToStorage(next);
    applyAppearanceToDocument(next);

    try {
      await apiFetch<AppearanceApiResponse>("/api/user/appearance", {
        method: "PUT",
        body: JSON.stringify(next),
      });
    } catch {
      // localStorage remains the immediate fallback when unauthenticated or offline
    }
  }, []);

  const setAppearance = useCallback(
    (next: AppearancePreferences) => {
      const normalised = {
        themeMode: next.themeMode,
        backgroundStyle: normaliseBackgroundForMode(next.themeMode, next.backgroundStyle),
      };
      setAppearanceState(normalised);
      void persistAppearance(normalised);
    },
    [persistAppearance],
  );

  const setThemeMode = useCallback(
    (mode: ThemeMode) => {
      setAppearance({
        themeMode: mode,
        backgroundStyle: normaliseBackgroundForMode(mode, appearance.backgroundStyle),
      });
    },
    [appearance.backgroundStyle, setAppearance],
  );

  const setBackgroundStyle = useCallback(
    (style: BackgroundStyle) => {
      setAppearance({
        themeMode: appearance.themeMode,
        backgroundStyle: normaliseBackgroundForMode(appearance.themeMode, style),
      });
    },
    [appearance.themeMode, setAppearance],
  );

  useEffect(() => {
    applyAppearanceToDocument(appearance);
  }, [appearance]);

  useEffect(() => {
    let cancelled = false;

    async function loadServerAppearance() {
      try {
        const response = await apiFetch<AppearanceApiResponse>("/api/user/appearance");
        if (cancelled) {
          return;
        }

        const resolved = resolveInitialAppearance(readAppearanceFromStorage(), response.appearance);
        setAppearanceState(resolved);
        applyAppearanceToDocument(resolved);
        writeAppearanceToStorage(resolved);
      } catch {
        // Keep local appearance when the API is unavailable
      }
    }

    void loadServerAppearance();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      appearance,
      setThemeMode,
      setBackgroundStyle,
      setAppearance,
    }),
    [appearance, setAppearance, setBackgroundStyle, setThemeMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
