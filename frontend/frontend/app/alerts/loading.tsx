import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <AppShell title="Overdue Token Alerts">
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-4 w-72 max-w-full" />
        <ListSkeleton columns={6} />
      </div>
    </AppShell>
  );
}
