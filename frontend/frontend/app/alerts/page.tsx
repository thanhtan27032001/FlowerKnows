"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { OverdueTokenList } from "@/components/tokens/overdue-token-list";

export default function AlertsPage() {
  const t = useTranslations("alerts");

  return (
    <AppShell title={t("title")}>
      <OverdueTokenList />
    </AppShell>
  );
}
