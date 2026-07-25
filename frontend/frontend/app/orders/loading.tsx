import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default function OrdersLoading() {
  return (
    <AppShell title="Orders">
      <ListSkeleton columns={8} />
    </AppShell>
  );
}
