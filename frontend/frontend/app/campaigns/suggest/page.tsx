"use client";

import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { SuggestCampaignForm } from "@/components/campaigns/suggest-campaign-form";

export default function SuggestCampaignPage() {
  const t = useTranslations("campaigns.suggest");

  return (
    <AppShell title={t("title")}>
      <div className="space-y-4">
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t("description")}
        </p>
        <SuggestCampaignForm />
      </div>
    </AppShell>
  );
}
