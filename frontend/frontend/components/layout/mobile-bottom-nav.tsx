"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  getMobileMoreItems,
  getMobilePrimaryItems,
  isNavActive,
  MORE_NAV_ICON,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import { ThemePresetList } from "@/components/layout/theme-picker";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tTheme = useTranslations("theme");
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = getMobilePrimaryItems();
  const moreItems = getMobileMoreItems();
  const moreActive = moreItems.some((item) => isNavActive(pathname, item.href));
  const MoreIcon = MORE_NAV_ICON;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label={tCommon("a11y.primaryNav")}
      >
        <ul className="grid h-16 grid-cols-4">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn("size-5", active && "stroke-[2.25px]")}
                    aria-hidden
                  />
                  <span className="truncate">{t(item.shortLabelKey)}</span>
                </Link>
              </li>
            );
          })}

          <li className="min-w-0">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex h-full w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors",
                moreActive || moreOpen
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
            >
              <MoreIcon
                className={cn(
                  "size-5",
                  (moreActive || moreOpen) && "stroke-[2.25px]"
                )}
                aria-hidden
              />
              <span className="truncate">{t("more")}</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="gap-0 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <SheetHeader className="pb-2">
            <SheetTitle>{t("more")}</SheetTitle>
          </SheetHeader>
          <ul className="grid gap-1 px-2 pb-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border/70 px-2 pt-3 pb-1">
            <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
              {tTheme("pickerTitle")}
            </p>
            <ThemePresetList className="px-1" />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
