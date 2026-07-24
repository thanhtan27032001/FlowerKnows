"use client";

import { AppShell } from "@/components/layout/app-shell";
import { OverdueTokenList } from "@/components/tokens/overdue-token-list";

export default function AlertsPage() {
  return (
    <AppShell title="Overdue Token Alerts">
      <p className="mb-4 text-sm text-muted-foreground">
        Holding tokens older than 30 days, sorted by days held.
      </p>
      <OverdueTokenList />
    </AppShell>
  );
}
