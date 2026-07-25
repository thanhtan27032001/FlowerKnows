import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CampaignsLoading() {
  const t = await getTranslations("campaigns");
  const tA11y = await getTranslations("common.a11y");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-4" aria-busy="true" aria-label={tA11y("loading")}>
        <Skeleton className="h-9 w-36" />
        <ListSkeleton columns={5} />
      </div>
    </AppShell>
  );
}
