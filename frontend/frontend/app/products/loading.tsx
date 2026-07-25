import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default async function ProductsLoading() {
  const t = await getTranslations("products");
  const tCommon = await getTranslations("common.a11y");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-4" aria-busy="true" aria-label={tCommon("loading")}>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        <ListSkeleton columns={5} />
      </div>
    </AppShell>
  );
}
