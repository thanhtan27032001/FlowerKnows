"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { StockLedgerList } from "@/components/stock/stock-ledger-list";

export default function StockLedgerPage() {
  const t = useTranslations("stockLedger");

  return (
    <AppShell title={t("title")}>
      <StockLedgerList />
    </AppShell>
  );
}
