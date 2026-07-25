import { getTranslations } from "next-intl/server";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { AppShell } from "@/components/layout/app-shell";

export default async function OrdersLoading() {
  const t = await getTranslations("orders");

  return (
    <AppShell title={t("title")}>
      <ListSkeleton columns={8} />
    </AppShell>
  );
}
