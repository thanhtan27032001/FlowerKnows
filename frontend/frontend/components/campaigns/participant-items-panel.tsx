"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Spinner } from "@/components/feedback/spinner";
import { CashOutForm } from "@/components/customers/cash-out-form";
import { ItemExchangeForm } from "@/components/customers/item-exchange-form";
import {
  campaignApi,
  campaignKeys,
  type ParticipantSummary,
  type ParticipantToken,
} from "@/src/lib/api/campaign";
import type { CustomerToken, TokenStatus } from "@/src/lib/api/customer";
import { formatCostPrice, formatDateTime, vnd } from "@/src/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  campaignId: string;
  participant: ParticipantSummary;
  canRecordItem: boolean;
  onRecordItem: () => void;
};

function toCustomerToken(
  token: ParticipantToken,
  participant: ParticipantSummary,
  sourceLabel: string
): CustomerToken {
  return {
    id: token.id,
    productId: token.productId,
    productName: token.productName,
    tokenValue: token.tokenValue,
    costBasis: token.costBasis,
    status: token.status as TokenStatus,
    sourceType: "CAMPAIGN",
    sourceId: participant.id,
    sourceLabel,
    createdAt: token.createdAt,
    daysHeld: 0,
    overdue: false,
  };
}

export function ParticipantItemsPanel({
  campaignId,
  participant,
  canRecordItem,
  onRecordItem,
}: Props) {
  const t = useTranslations("campaigns.participantPanel");
  const tCommon = useTranslations("common");
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);

  const tokensQuery = useQuery({
    queryKey: campaignKeys.participantTokens(campaignId, participant.id),
    queryFn: () =>
      campaignApi.listParticipantTokens(campaignId, participant.id),
  });

  const holdingTokens = useMemo(
    () => (tokensQuery.data ?? []).filter((tok) => tok.actionable),
    [tokensQuery.data]
  );
  const sourceCampaignLabel = t("sourceCampaign");
  const selectedTokens = useMemo(
    () =>
      holdingTokens
        .filter((tok) => selectedIds.has(tok.id))
        .map((tok) => toCustomerToken(tok, participant, sourceCampaignLabel)),
    [holdingTokens, selectedIds, participant, sourceCampaignLabel]
  );

  const tokens = tokensQuery.data ?? [];
  const itemsRecorded = tokensQuery.isSuccess
    ? tokens.length
    : (participant.itemsRecorded ?? 0);

  const itemNamesPreview = useMemo(() => {
    const names = tokensQuery.isSuccess
      ? (tokensQuery.data ?? []).map((tok) => tok.productName)
      : (participant.recordedItemNames ?? []);
    if (names.length === 0) return null;
    const shown = names.slice(0, 3);
    const text = shown.join(", ");
    const hasMore = itemsRecorded > 3 || names.length > 3;
    return hasMore ? `${text}...` : text;
  }, [
    tokensQuery.isSuccess,
    tokensQuery.data,
    participant.recordedItemNames,
    itemsRecorded,
  ]);

  const toggleToken = (tokenId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const refreshAfterAction = async () => {
    clearSelection();
    await queryClient.invalidateQueries({
      queryKey: campaignKeys.participantTokens(campaignId, participant.id),
    });
    await queryClient.invalidateQueries({
      queryKey: campaignKeys.detail(campaignId),
    });
  };

  return (
    <div className="rounded-lg ring-1 ring-foreground/10 bg-card">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/40"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <ChevronDownIcon
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />

        <span className="min-w-0 shrink-0 basis-[7rem] truncate text-sm font-semibold leading-tight sm:basis-[9rem]">
          {participant.customerName}
        </span>

        <span className="flex min-w-0 flex-1 flex-col items-start leading-none">
          <span className="text-[0.65rem] text-muted-foreground">
            {t("itemNames")}
          </span>
          <span
            className="mt-0.5 w-full truncate text-sm font-semibold tracking-tight"
            title={itemNamesPreview ?? undefined}
          >
            {itemNamesPreview ?? t("noItems")}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3 sm:gap-5">
          <span className="flex min-w-[2.75rem] flex-col items-end leading-none">
            <span className="text-[0.65rem] text-muted-foreground">
              {t("bags")}
            </span>
            <span className="mt-0.5 text-sm font-semibold tabular-nums tracking-tight">
              {participant.totalBagsPurchased}
            </span>
          </span>
          <span className="flex min-w-[3.5rem] flex-col items-end leading-none">
            <span className="text-[0.65rem] text-muted-foreground">
              {t("itemsRecorded")}
            </span>
            <span
              className={cn(
                "mt-0.5 text-sm font-semibold tabular-nums tracking-tight",
                itemsRecorded >= participant.totalBagsPurchased
                  ? "text-foreground"
                  : "text-amber-700 dark:text-amber-400"
              )}
            >
              {t("itemsProgress", {
                recorded: itemsRecorded,
                bags: participant.totalBagsPurchased,
              })}
            </span>
          </span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/60 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
            <span>
              {participant.customerPhone || tCommon("fallback.noPhone")}
            </span>
            <span className="tabular-nums">
              {t("prepaid")}: {vnd.format(participant.prepaidAmount)}
            </span>
            <Link
              href={`/customers/${participant.customerId}`}
              className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLinkIcon className="size-3" />
              {t("viewProfile")}
            </Link>
            {canRecordItem && (
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onRecordItem();
                }}
              >
                {t("recordItem")}
              </Button>
            )}
          </div>

          {tokensQuery.isLoading && (
            <div
              className="space-y-1.5"
              aria-busy="true"
              aria-label={t("loading")}
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Spinner />
                {t("loading")}
              </div>
              {Array.from({ length: 2 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          )}

          {tokensQuery.isError && (
            <QueryErrorState
              message={
                tokensQuery.error instanceof Error
                  ? tokensQuery.error.message
                  : t("loadError")
              }
              onRetry={() => tokensQuery.refetch()}
            />
          )}

          {tokensQuery.isSuccess && tokens.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("empty")}</p>
          )}

          {tokens.length > 0 && (
            <>
              <div className="divide-y divide-border/50 rounded-md ring-1 ring-border/60">
                {tokens.map((token) => (
                  <ParticipantTokenRow
                    key={token.id}
                    token={token}
                    selected={selectedIds.has(token.id)}
                    onToggle={() => toggleToken(token.id)}
                  />
                ))}
              </div>

              {holdingTokens.length > 0 && isOwner && (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    className="h-7"
                    disabled={selectedTokens.length === 0}
                    onClick={() => setExchangeOpen(true)}
                  >
                    {t("itemExchange")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    disabled={selectedTokens.length === 0}
                    onClick={() => setCashOutOpen(true)}
                  >
                    {t("cashOut")}
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={clearSelection}
                    >
                      {t("clearSelection")}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {isOwner ? (
            <>
              <ItemExchangeForm
                key={
                  exchangeOpen
                    ? `ex-${participant.id}-${[...selectedIds].join(",")}`
                    : `ex-${participant.id}-closed`
                }
                open={exchangeOpen}
                onOpenChange={setExchangeOpen}
                customerId={participant.customerId}
                tokens={selectedTokens}
                onSuccess={() => void refreshAfterAction()}
              />
              <CashOutForm
                key={
                  cashOutOpen
                    ? `co-${participant.id}-${[...selectedIds].join(",")}`
                    : `co-${participant.id}-closed`
                }
                open={cashOutOpen}
                onOpenChange={setCashOutOpen}
                customerId={participant.customerId}
                tokens={selectedTokens}
                onSuccess={() => void refreshAfterAction()}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ParticipantTokenRow({
  token,
  selected,
  onToggle,
}: {
  token: ParticipantToken;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("campaigns.participantPanel");

  const body = (
    <>
      {token.actionable ? (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded border text-[0.65rem]",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-transparent"
          )}
          aria-hidden
        >
          ✓
        </span>
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">
        {token.productName}
      </span>
      <span className="hidden tabular-nums text-muted-foreground sm:inline">
        {vnd.format(token.tokenValue)}
      </span>
      <span className="hidden tabular-nums text-muted-foreground md:inline">
        {formatCostPrice(token.costBasis)}
      </span>
      <StatusBadge
        type="token"
        status={token.actionable ? "HOLDING" : token.status}
        className="shrink-0 scale-90"
      />
    </>
  );

  if (!token.actionable) {
    return (
      <div
        className="flex items-center gap-2 bg-muted/20 px-2.5 py-1.5 text-xs"
        title={t("issued", { date: formatDateTime(token.createdAt) })}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      title={t("issued", { date: formatDateTime(token.createdAt) })}
      className={cn(
        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted/40",
        selected && "bg-primary/5"
      )}
    >
      {body}
    </button>
  );
}
