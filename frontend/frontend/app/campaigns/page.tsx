"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell title={t("title")}>
      <CampaignList onCreate={() => setCreateOpen(true)} />
      <CreateCampaignForm open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
