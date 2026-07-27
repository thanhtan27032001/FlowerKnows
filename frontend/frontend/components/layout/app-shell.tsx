"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { PageFade } from "@/components/feedback/page-fade";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ThemePicker } from "@/components/layout/theme-picker";
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
    <AuthGuard>
      <TooltipProvider>
        <SidebarProvider
          className="min-h-svh bg-[linear-gradient(165deg,var(--background)_0%,var(--muted)_42%,var(--background)_100%)]"
          style={
            {
              "--sidebar-width": "15rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar />

          <SidebarInset className="min-w-0 bg-transparent">
            <div className="mx-auto w-full min-w-0 max-w-6xl overflow-x-clip px-4 py-5 pb-24 md:px-6 md:py-8 lg:pb-8">
              <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    {title}
                  </h1>
                  <ThemePicker
                    className="shrink-0 lg:hidden"
                    side="bottom"
                    align="end"
                  />
                </div>
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
    </AuthGuard>
  );
}
