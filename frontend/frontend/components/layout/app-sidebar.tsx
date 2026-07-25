"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
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
  const sections = getNavSections();

  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-r border-sidebar-border bg-sidebar lg:flex"
    >
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link
          href="/"
          className="px-2 font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-sidebar-foreground"
        >
          Flower Knows
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1 py-2">
        {sections.map((section) => (
          <SidebarGroup key={section.id} className="py-1">
            {section.label ? (
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavActive(pathname, item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                      >
                        <Icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
