"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { ExportTablePreview } from "@/components/export/export-table-preview";
import { Spinner } from "@/components/feedback/spinner";
import { Button } from "@/components/ui/button";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
  type ParticipantSummary,
  type ParticipantToken,
} from "@/src/lib/api/campaign";
import { aggregateParticipantsForExport } from "@/src/lib/campaigns/aggregate-export";
import { campaignExportFilename } from "@/src/lib/export/filename";
import type { ExportCustomerGroup } from "@/src/lib/export/types";

type Props = {
  campaign: CampaignDetail;
  selectedIds: Set<string>;
};

export function CampaignParticipantExportBar({
  campaign,
  selectedIds,
}: Props) {
  const t = useTranslations("common.export");
  const tDetail = useTranslations("campaigns.detail");
  const tExport = useTranslations("campaigns.export");
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [groups, setGroups] = useState<ExportCustomerGroup[]>([]);
  const [filename, setFilename] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedParticipants = useMemo(
    () =>
      campaign.participants.filter(
        (p) =>
          selectedIds.has(p.id) && (p.status ?? "CONFIRMED") === "CONFIRMED"
      ),
    [campaign.participants, selectedIds]
  );

  const openPreview = async () => {
    if (selectedParticipants.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const sources = await Promise.all(
        selectedParticipants.map(async (participant: ParticipantSummary) => {
          const tokens = await queryClient.fetchQuery({
            queryKey: campaignKeys.participantTokens(
              campaign.id,
              participant.id
            ),
            queryFn: () =>
              campaignApi.listParticipantTokens(campaign.id, participant.id),
          });
          return {
            participant,
            tokens: tokens as ParticipantToken[],
          };
        })
      );
      setGroups(aggregateParticipantsForExport(sources));
      setFilename(campaignExportFilename(campaign.name));
      setPreviewOpen(true);
    } catch (err) {
      console.error("Campaign participant export failed to load tokens", err);
      setError(tExport("loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={selectedIds.size === 0 || loading}
          onClick={() => void openPreview()}
        >
          {loading ? (
            <Spinner className="size-3.5" />
          ) : (
            <ImageIcon data-icon="inline-start" />
          )}
          {loading ? tDetail("exportLoading") : t("button")}
          {!loading && selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
        </Button>
        {error && (
          <span className="text-xs text-destructive sm:text-sm">{error}</span>
        )}
      </div>

      <ExportTablePreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        groups={groups}
        filename={filename}
      />
    </>
  );
}
