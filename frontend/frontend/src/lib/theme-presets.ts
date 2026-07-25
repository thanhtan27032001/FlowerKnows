export const THEME_PRESET_STORAGE_KEY = "fk-theme-preset";

export const THEME_PRESETS = ["sage", "rose", "vivid", "sunset"] as const;

export type ThemePreset = (typeof THEME_PRESETS)[number];

export const DEFAULT_THEME_PRESET: ThemePreset = "sage";

/** Primary swatch colors for each preset (light-mode primary). */
export const THEME_PRESET_SWATCHES: Record<ThemePreset, string> = {
  sage: "oklch(0.856 0.053 118.1)",
  rose: "oklch(0.465 0.113 2.4)",
  vivid: "oklch(0.597 0.221 4.8)",
  sunset: "oklch(0.734 0.179 56.1)",
};

export function isThemePreset(value: unknown): value is ThemePreset {
  return (
    typeof value === "string" &&
    (THEME_PRESETS as readonly string[]).includes(value)
  );
}
