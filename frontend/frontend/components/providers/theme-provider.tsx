"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME_PRESET,
  THEME_PRESET_STORAGE_KEY,
  THEME_PRESETS,
  isThemePreset,
  type ThemePreset,
} from "@/src/lib/theme-presets";

type ThemePresetContextValue = {
  preset: ThemePreset;
  setPreset: (preset: ThemePreset) => void;
  presets: readonly ThemePreset[];
};

const ThemePresetContext = createContext<ThemePresetContextValue | null>(null);

/**
 * Captures the color-preset ThemeProvider context, then nests the dark/light
 * provider so `useTheme()` remains the dark/light API.
 */
function ThemePresetBridge({ children }: { children: ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const value = useMemo<ThemePresetContextValue>(() => {
    const preset: ThemePreset =
      mounted && isThemePreset(theme) ? theme : DEFAULT_THEME_PRESET;
    return {
      preset,
      setPreset: (next: ThemePreset) => setTheme(next),
      presets: THEME_PRESETS,
    };
  }, [mounted, setTheme, theme]);

  return (
    <ThemePresetContext.Provider value={value}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </NextThemesProvider>
    </ThemePresetContext.Provider>
  );
}

/**
 * Color preset via `data-theme` (storage: fk-theme-preset).
 * Dark/light via nested `class` provider (`.dark`).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme={DEFAULT_THEME_PRESET}
      themes={[...THEME_PRESETS]}
      enableSystem={false}
      enableColorScheme={false}
      storageKey={THEME_PRESET_STORAGE_KEY}
      disableTransitionOnChange
    >
      <ThemePresetBridge>{children}</ThemePresetBridge>
    </NextThemesProvider>
  );
}

export function useThemePreset() {
  const ctx = useContext(ThemePresetContext);
  if (!ctx) {
    throw new Error("useThemePreset must be used within ThemeProvider");
  }
  return ctx;
}
