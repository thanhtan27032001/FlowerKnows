"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CampaignList } from "@/components/campaigns/campaign-list";
import { CreateCampaignForm } from "@/components/campaigns/create-campaign-form";

export default function CampaignsPage() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell title="Campaigns">
      <CampaignList onCreate={() => setCreateOpen(true)} />
      <CreateCampaignForm open={createOpen} onOpenChange={setCreateOpen} />
    </AppShell>
  );
}
