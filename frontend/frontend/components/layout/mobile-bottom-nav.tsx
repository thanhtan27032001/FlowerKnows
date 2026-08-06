"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { LogOutIcon } from "lucide-react";
import {
  getMobileMoreItems,
  getMobilePrimaryItems,
  isNavActive,
  MORE_NAV_ICON,
} from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import { ThemePresetList } from "@/components/layout/theme-picker";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tTheme = useTranslations("theme");
  const tAuth = useTranslations("auth");
  const { role, session, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = role ? getMobilePrimaryItems(role) : [];
  const moreItems = role ? getMobileMoreItems(role) : [];
  const moreActive = moreItems.some((item) => isNavActive(pathname, item.href));
  const MoreIcon = MORE_NAV_ICON;
  const gridCols =
    primaryItems.length <= 2 ? "grid-cols-3" : "grid-cols-4";

  const onLogout = () => {
    setMoreOpen(false);
    logout();
    router.replace("/login");
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/25 bg-white/30 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-sm lg:hidden"
        aria-label={tCommon("a11y.primaryNav")}
      >
        <ul className={cn("grid h-[var(--fk-mobile-bottom-nav-height)]", gridCols)}>
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);

            return (
              <li key={item.href} className="flex min-w-0 p-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors",
                    active
                      ? "fk-nav-active-mobile"
                      : "text-muted-foreground/70 hover:bg-sidebar-accent/40 hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon
                    className={cn(
                      "size-5",
                      active && "stroke-[2.25px]"
                    )}
                    aria-hidden
                  />
                  <span className="truncate">{t(item.shortLabelKey)}</span>
                </Link>
              </li>
            );
          })}

          <li className="flex min-w-0 p-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors",
                moreActive || moreOpen
                  ? "fk-nav-active-mobile"
                  : "text-muted-foreground/70 hover:bg-sidebar-accent/40 hover:text-foreground"
              )}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
            >
              <MoreIcon
                className={cn(
                  "size-5",
                  (moreActive || moreOpen) && "text-primary stroke-[2.25px]"
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
          {session ? (
            <p className="px-5 pb-2 text-sm text-muted-foreground">
              {session.fullName}
              <span className="text-muted-foreground/70">
                {" "}
                · {tAuth(`roles.${session.role}`)}
              </span>
            </p>
          ) : null}
          {moreItems.length > 0 ? (
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
                          ? "fk-nav-active"
                          : "fk-nav-item text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
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
          ) : null}
          <div className="border-t border-border/70 px-2 pt-3 pb-1">
            <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground">
              {tTheme("pickerTitle")}
            </p>
            <ThemePresetList className="px-1" />
          </div>
          <div className="border-t border-border/70 px-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start gap-2 text-muted-foreground"
              onClick={onLogout}
            >
              <LogOutIcon className="size-4" />
              {tAuth("logout")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
