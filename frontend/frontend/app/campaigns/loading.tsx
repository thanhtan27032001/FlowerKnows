import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <AppShell title="Campaigns">
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-9 w-36" />
        <ListSkeleton columns={5} />
      </div>
    </AppShell>
  );
}
