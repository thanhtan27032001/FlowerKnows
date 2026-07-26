"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";
import { useAuth } from "@/components/providers/auth-provider";

export default function CampaignsPage() {
  const t = useTranslations("campaigns");
  const { isOwner } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell title={t("title")}>
      <CampaignList onCreate={() => setCreateOpen(true)} />
      {isOwner ? (
        <CreateCampaignForm open={createOpen} onOpenChange={setCreateOpen} />
      ) : null}
    </AppShell>
  );
}
