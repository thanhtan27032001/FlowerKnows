import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <AppShell title="Products">
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <ListSkeleton columns={5} />
      </div>
    </AppShell>
  );
}
