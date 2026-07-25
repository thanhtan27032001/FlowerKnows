"use client";

import { PageFade } from "@/components/feedback/page-fade";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        className="min-h-svh bg-[linear-gradient(165deg,#fffdfe_0%,#fff4e8_42%,#ffffff_100%)]"
        style={
          {
            "--sidebar-width": "15rem",
          } as React.CSSProperties
        }
      >
        <AppSidebar />

        <SidebarInset className="bg-transparent">
          <div className="mx-auto w-full max-w-6xl px-4 py-5 pb-24 md:px-6 md:py-8 lg:pb-8">
            <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {title}
              </h1>
              {actions ? (
                <div className="flex shrink-0 items-center gap-2">{actions}</div>
              ) : null}
            </div>
            <PageFade>{children}</PageFade>
          </div>
        </SidebarInset>

        <MobileBottomNav />
      </SidebarProvider>
    </TooltipProvider>
  );
}
