"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { StockCountList } from "@/components/stocktake/stock-count-list";

export default function StocktakePage() {
  const t = useTranslations("stocktake");

  return (
    <AppShell title={t("title")}>
      <StockCountList />
    </AppShell>
  );
}
