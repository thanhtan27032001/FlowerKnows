import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default async function AlertsLoading() {
  const t = await getTranslations("alerts");
  const tCommon = await getTranslations("common.a11y");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-4" aria-busy="true" aria-label={tCommon("loading")}>
        <ListSkeleton columns={6} />
      </div>
    </AppShell>
  );
}
