"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemePicker } from "@/components/layout/theme-picker";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getNavSections, isNavActive } from "@/components/layout/nav-config";

export function AppSidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const sections = getNavSections();

  return (
    <Sidebar
      collapsible="none"
      className="fk-sidebar-shell sticky top-0 hidden h-svh lg:flex"
    >
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link
          href="/"
          className="px-2 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-sidebar-foreground"
        >
          {tCommon("brand")}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1 py-2">
        {sections.map((section) => {
          const sectionLabel = section.labelKey
            ? t(`sections.${section.labelKey}`)
            : null;

          return (
            <SidebarGroup key={section.id} className="py-1">
              {sectionLabel ? (
                <SidebarGroupLabel>{sectionLabel}</SidebarGroupLabel>
              ) : null}
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavActive(pathname, item.href);
                    const label = t(item.labelKey);

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          isActive={active}
                          tooltip={label}
                          className={active ? "fk-nav-active" : "fk-nav-item"}
                          render={<Link href={item.href} />}
                        >
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border px-2 py-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="truncate px-1 text-xs text-muted-foreground">
            {tCommon("brand")}
          </span>
          <ThemePicker />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
