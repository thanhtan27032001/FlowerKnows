import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <AppShell title="Customers">
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-48 flex-1" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
        <ListSkeleton columns={5} />
      </div>
    </AppShell>
  );
}
