"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  campaignId: string;
  participant: ParticipantSummary;
  canRecordItem: boolean;
  onRecordItem: () => void;
};

function toCustomerToken(
  token: ParticipantToken,
  participant: ParticipantSummary
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
    sourceLabel: "Campaign",
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
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);

  const tokensQuery = useQuery({
    queryKey: campaignKeys.participantTokens(campaignId, participant.id),
    queryFn: () =>
      campaignApi.listParticipantTokens(campaignId, participant.id),
    enabled: expanded,
  });

  const tokens = tokensQuery.data ?? [];
  const holdingTokens = useMemo(
    () => tokens.filter((t) => t.actionable),
    [tokens]
  );
  const selectedTokens = useMemo(
    () =>
      holdingTokens
        .filter((t) => selectedIds.has(t.id))
        .map((t) => toCustomerToken(t, participant)),
    [holdingTokens, selectedIds, participant]
  );

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
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <div className="flex items-start gap-2">
              <ChevronDownIcon
                className={cn(
                  "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-180"
                )}
              />
              <div className="min-w-0">
                <CardTitle className="text-base leading-snug">
                  {participant.customerName}
                </CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {participant.customerPhone || "No phone"}
                </p>
              </div>
            </div>
          </button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Hide items" : "View items"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 pl-6 text-sm">
          <div>
            <p className="text-muted-foreground">Bags</p>
            <p className="font-medium tabular-nums">
              {participant.totalBagsPurchased}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Prepaid</p>
            <p className="font-medium tabular-nums">
              {vnd.format(participant.prepaidAmount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pl-6">
          <Link
            href={`/customers/${participant.customerId}`}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted hover:text-foreground"
            )}
          >
            <ExternalLinkIcon className="size-3.5" />
            View full customer profile
          </Link>
          {canRecordItem && (
            <Button size="sm" variant="outline" onClick={onRecordItem}>
              Record Item
            </Button>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 border-t border-border/60 pt-4">
          {tokensQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading items…</p>
          )}

          {tokensQuery.isError && (
            <p className="text-sm text-destructive">
              {tokensQuery.error instanceof Error
                ? tokensQuery.error.message
                : "Failed to load participant items"}
            </p>
          )}

          {tokensQuery.isSuccess && tokens.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No items recorded for this participant yet.
            </p>
          )}

          {tokens.length > 0 && (
            <>
              <div className="space-y-2">
                {tokens.map((token) => (
                  <ParticipantTokenRow
                    key={token.id}
                    token={token}
                    selected={selectedIds.has(token.id)}
                    onToggle={() => toggleToken(token.id)}
                  />
                ))}
              </div>

              {holdingTokens.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={selectedTokens.length === 0}
                    onClick={() => setExchangeOpen(true)}
                  >
                    Item Exchange
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selectedTokens.length === 0}
                    onClick={() => setCashOutOpen(true)}
                  >
                    Cash Out
                  </Button>
                  {selectedIds.size > 0 && (
                    <Button size="sm" variant="ghost" onClick={clearSelection}>
                      Clear selection
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

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
        </CardContent>
      )}
    </Card>
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
  if (!token.actionable) {
    return (
      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug">{token.productName}</p>
          <Badge variant="secondary" className="shrink-0">
            {token.statusLabel}
          </Badge>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-muted-foreground">Token value</p>
            <p className="tabular-nums">{vnd.format(token.tokenValue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cost basis</p>
            <p className="tabular-nums">{formatCostPrice(token.costBasis)}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Issued {formatDateTime(token.createdAt)}
        </p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="w-full rounded-xl border border-border/80 p-3 text-left text-sm transition-colors hover:bg-muted/30"
    >
      <div
        className={cn(
          "rounded-[10px] -m-1 p-1",
          selected && "ring-2 ring-primary/60 bg-primary/5"
        )}
      >
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-transparent"
            )}
            aria-hidden
          >
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium leading-snug">{token.productName}</p>
              <Badge variant="outline" className="shrink-0">
                Holding
              </Badge>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-muted-foreground">Token value</p>
                <p className="font-medium tabular-nums">
                  {vnd.format(token.tokenValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cost basis</p>
                <p className="font-medium tabular-nums">
                  {formatCostPrice(token.costBasis)}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Issued {formatDateTime(token.createdAt)}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
