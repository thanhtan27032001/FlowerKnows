import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CustomersLoading() {
  const t = await getTranslations("customers");
  const tA11y = await getTranslations("common.a11y");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-4" aria-busy="true" aria-label={tA11y("loading")}>
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
