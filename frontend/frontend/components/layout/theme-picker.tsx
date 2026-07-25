"use client";

import { PaletteIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useThemePreset } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { THEME_PRESET_SWATCHES } from "@/src/lib/theme-presets";

export function ThemePicker() {
  const t = useTranslations("theme");
  const { preset, setPreset, presets } = useThemePreset();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("pickerLabel")}
            className="text-sidebar-foreground"
          />
        }
      >
        <PaletteIcon />
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-56 gap-2 p-2"
      >
        <PopoverHeader className="px-1 pb-0.5">
          <PopoverTitle className="text-xs font-medium text-muted-foreground">
            {t("pickerTitle")}
          </PopoverTitle>
        </PopoverHeader>
        <div
          className="flex flex-col gap-0.5"
          role="listbox"
          aria-label={t("pickerTitle")}
        >
          {presets.map((id) => {
            const selected = preset === id;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => setPreset(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                  selected && "bg-muted"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 rounded-full ring-1 ring-foreground/15",
                    selected && "ring-2 ring-ring"
                  )}
                  style={{ backgroundColor: THEME_PRESET_SWATCHES[id] }}
                />
                <span className="truncate">{t(`presets.${id}`)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
