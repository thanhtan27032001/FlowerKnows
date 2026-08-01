"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { DirectSaleList } from "@/components/direct-sales/direct-sale-list";

export default function DirectSalesPage() {
  const t = useTranslations("directSales");

  return (
    <AppShell title={t("title")}>
      <DirectSaleList />
    </AppShell>
  );
}
