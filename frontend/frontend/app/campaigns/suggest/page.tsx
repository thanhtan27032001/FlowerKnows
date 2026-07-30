"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { SuggestCampaignForm } from "@/components/campaigns/suggest-campaign-form";

export default function SuggestCampaignPage() {
  const t = useTranslations("campaigns.suggest");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-2">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("description")}
        </p>
        <SuggestCampaignForm />
      </div>
    </AppShell>
  );
}
