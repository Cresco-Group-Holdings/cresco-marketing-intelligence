"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DARK_BACKGROUNDS,
  LIGHT_BACKGROUNDS,
  type BackgroundStyle,
  type ThemeMode,
} from "@/lib/theme/types";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const BACKGROUND_LABELS: Record<BackgroundStyle, string> = {
  charcoal: "Charcoal",
  graphite: "Graphite",
  beige: "Beige",
  "warm-ivory": "Warm Ivory",
  neutral: "Neutral",
};

function Swatch({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-4 w-4 rounded border border-border",
        active && "ring-2 ring-paid-accent ring-offset-1 ring-offset-surface-elevated",
      )}
    />
  );
}

export function AppearanceMenu() {
  const { appearance, setThemeMode, setBackgroundStyle } = useTheme();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const backgroundOptions =
    appearance.themeMode === "dark" ? DARK_BACKGROUNDS : LIGHT_BACKGROUNDS;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Appearance</span>
      </Button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Appearance settings"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface-elevated p-4 shadow-lg"
        >
          <p className="text-sm font-semibold text-foreground">Appearance</p>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Theme
            </p>
            <div className="mt-2 space-y-1" role="radiogroup" aria-label="Theme mode">
              {THEME_OPTIONS.map((option) => {
                const active = appearance.themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-surface-hover text-foreground"
                        : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                    onClick={() => setThemeMode(option.value)}
                  >
                    <span>{option.label}</span>
                    {active ? <Check className="h-4 w-4 text-paid-accent" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
              Background
            </p>
            <div className="mt-2 space-y-1" role="radiogroup" aria-label="Background style">
              {backgroundOptions.map((option) => {
                const active = appearance.backgroundStyle === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-surface-hover text-foreground"
                        : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                    onClick={() => setBackgroundStyle(option)}
                  >
                    <span className="flex items-center gap-2">
                      <Swatch active={active} />
                      {BACKGROUND_LABELS[option]}
                    </span>
                    {active ? <Check className="h-4 w-4 text-paid-accent" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
