"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { CampaignParticipantExportBar } from "@/components/campaigns/campaign-participant-export-bar";
import { CloseCampaignDialog } from "@/components/campaigns/close-campaign-dialog";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { EditCampaignForm } from "@/components/campaigns/edit-campaign-form";
import { ParticipantItemsPanel } from "@/components/campaigns/participant-items-panel";
import { RecordItemForm } from "@/components/campaigns/record-item-form";
import { RecordParticipantForm } from "@/components/campaigns/record-participant-form";
import { ReopenCampaignDialog } from "@/components/campaigns/reopen-campaign-dialog";
import { campaignApi, campaignKeys, campaignLiveQueryOptions } from "@/src/lib/api/campaign";
import { campaignStatusLabel } from "@/src/lib/i18n-labels";
import { formatDate, formatDateTime, vnd } from "@/src/lib/format";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function CampaignDetailSkeleton() {
  const tA11y = useTranslations("common.a11y");
  return (
    <div className="space-y-5" aria-busy="true" aria-label={tA11y("loading")}>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("campaigns");
  const tDetail = useTranslations("campaigns.detail");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common");
  const { isOwner } = useAuth();
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemCustomerId, setItemCustomerId] = useState("");
  const [poolExpanded, setPoolExpanded] = useState(false);
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(
    new Set()
  );

  const {
    data: campaign,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignApi.get(id),
    ...campaignLiveQueryOptions,
  });

  const confirmedParticipants = useMemo(
    () =>
      (campaign?.participants ?? []).filter(
        (p) => (p.status ?? "CONFIRMED") === "CONFIRMED"
      ),
    [campaign?.participants]
  );

  const participantsByAddedAsc = useMemo(
    () =>
      [...(campaign?.participants ?? [])].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [campaign?.participants]
  );

  const toggleExportSelect = (participantId: string) => {
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(participantId)) next.delete(participantId);
      else next.add(participantId);
      return next;
    });
  };

  const canDelete = (campaign?.participants.length ?? 0) === 0;

  const openRecordItem = (customerId = "") => {
    setItemCustomerId(customerId);
    setItemOpen(true);
  };

  const poolPreviewLimit = 3;
  const canTogglePool = (campaign?.pool.length ?? 0) > poolPreviewLimit;
  const visiblePool =
    campaign == null
      ? []
      : canTogglePool && !poolExpanded
        ? campaign.pool.slice(0, poolPreviewLimit)
        : campaign.pool;

  return (
    <AppShell
      title={campaign?.name ?? t("detailFallbackTitle")}
      actions={
        <Link
          href="/campaigns"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {tCommon("actions.back")}
        </Link>
      }
    >
      <div className="relative">
        <QueryProgressBar active={isFetching && !isLoading} />

        {isLoading && <CampaignDetailSkeleton />}

        {isError && (
          <QueryErrorState
            message={
              error instanceof Error ? error.message : tDetail("loadError")
            }
            onRetry={() => refetch()}
          />
        )}

        {campaign && (
          <div className="min-w-0 space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">{campaign.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tDetail("createdAt", {
                      date: formatDateTime(campaign.createdAt),
                    })}
                  </p>
                </div>
                <StatusBadge
                  variant={campaign.status === "OPEN" ? "info" : "neutral"}
                >
                  {campaignStatusLabel(tStatus, campaign.status)}
                </StatusBadge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("eventDate")}
                    </p>
                    <p className="font-medium">{formatDate(campaign.eventDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("bagPrice")}
                    </p>
                    <p className="font-medium tabular-nums">
                      {vnd.format(campaign.bagPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("bagsSold")}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {campaign.bagsSold}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {campaign.totalBags}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {tDetail("remainingBags")}
                    </p>
                    <p className="font-medium tabular-nums">
                      {campaign.totalBags - campaign.bagsSold}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {campaign.status === "OPEN" && (
                    <>
                      <Button onClick={() => setParticipantOpen(true)}>
                        {tDetail("recordParticipant")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => openRecordItem()}
                        disabled={confirmedParticipants.length === 0}
                      >
                        {tDetail("recordItem")}
                      </Button>
                      {isOwner && (
                        <Button
                          variant="outline"
                          onClick={() => setCloseOpen(true)}
                        >
                          {tDetail("closeCampaign")}
                        </Button>
                      )}
                      {isOwner && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setEditOpen(true)}
                          >
                            {tDetail("editCampaign")}
                          </Button>
                          {canDelete ? (
                            <Button
                              variant="destructive"
                              onClick={() => setDeleteOpen(true)}
                            >
                              {tDetail("deleteCampaign")}
                            </Button>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <span className="inline-flex cursor-not-allowed" />
                                }
                              >
                                <Button variant="destructive" disabled>
                                  {tDetail("deleteCampaign")}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {tDetail("deleteBlockedTooltip")}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </>
                  )}
                  {campaign.status === "CLOSED" && isOwner && (
                    <Button onClick={() => setReopenOpen(true)}>
                      {tDetail("reopenCampaign")}
                    </Button>
                  )}
                </div>

                {campaign.status === "CLOSED" && (
                  <p className="text-sm text-muted-foreground">
                    {tDetail("closedNotice")}
                  </p>
                )}
              </CardContent>
            </Card>

            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  {tDetail("poolTitle")}
                </h2>
                {campaign.poolQuantityTotal < campaign.totalBags ? (
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {tDetail("poolLoadedHint", {
                      loaded: campaign.poolQuantityTotal,
                      total: campaign.totalBags,
                    })}
                  </p>
                ) : null}
              </div>

              {campaign.pool.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {tDetail("poolEmpty")}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  <div className="fk-table-surface">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tCommon("fields.product")}</TableHead>
                          <TableHead className="w-[5.5rem] text-right">
                            {tDetail("loaded")}
                          </TableHead>
                          <TableHead className="w-[5.5rem] text-right">
                            {tDetail("remaining")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visiblePool.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="max-w-0 truncate font-medium">
                              {item.productName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.loadedQuantity}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {item.remainingQuantity}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {canTogglePool && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => setPoolExpanded((v) => !v)}
                    >
                      {poolExpanded
                        ? tDetail("showLessPool")
                        : tDetail("showMorePool", {
                            count: campaign.pool.length - poolPreviewLimit,
                          })}
                    </Button>
                  )}
                </div>
              )}
            </section>

            <section className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  {tDetail("participantsTitle")}
                </h2>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isOwner && participantsByAddedAsc.length > 0 && (
                    <CampaignParticipantExportBar
                      campaign={campaign}
                      selectedIds={exportSelectedIds}
                    />
                  )}
                  {campaign.status === "OPEN" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setParticipantOpen(true)}
                    >
                      {tDetail("recordParticipant")}
                    </Button>
                  )}
                </div>
              </div>

              {participantsByAddedAsc.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {tDetail("participantsEmpty")}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid min-w-0 gap-1">
                  {participantsByAddedAsc.map((p) => {
                    const isDraft = (p.status ?? "CONFIRMED") === "DRAFT";
                    return (
                      <ParticipantItemsPanel
                        key={p.id}
                        campaign={campaign}
                        participant={p}
                        canRecordItem={
                          campaign.status === "OPEN" && !isDraft
                        }
                        onRecordItem={() => openRecordItem(p.customerId)}
                        exportSelectable={isOwner && !isDraft}
                        exportSelected={exportSelectedIds.has(p.id)}
                        onToggleExportSelect={() => toggleExportSelect(p.id)}
                      />
                    );
                  })}
                </div>
              )}
            </section>

            {isOwner ? (
              <>
                <CloseCampaignDialog
                  campaignId={campaign.id}
                  open={closeOpen}
                  onOpenChange={setCloseOpen}
                  onClosed={() => void refetch()}
                />
                <ReopenCampaignDialog
                  campaignId={campaign.id}
                  pool={campaign.pool}
                  open={reopenOpen}
                  onOpenChange={setReopenOpen}
                  onReopened={() => void refetch()}
                />
                <EditCampaignForm
                  open={editOpen}
                  onOpenChange={setEditOpen}
                  campaign={campaign}
                />
                <DeleteCampaignDialog
                  campaignId={campaign.id}
                  campaignName={campaign.name}
                  open={deleteOpen}
                  onOpenChange={setDeleteOpen}
                />
              </>
            ) : null}
            <RecordParticipantForm
              key={participantOpen ? "participant-open" : "participant-closed"}
              open={participantOpen}
              onOpenChange={setParticipantOpen}
              campaign={campaign}
            />
            <RecordItemForm
              key={itemOpen ? `item-${itemCustomerId || "any"}` : "item-closed"}
              open={itemOpen}
              onOpenChange={setItemOpen}
              campaign={campaign}
              defaultCustomerId={itemCustomerId}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
