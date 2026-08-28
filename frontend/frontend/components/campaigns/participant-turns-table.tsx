"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangleIcon, Trash2Icon, XIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Spinner } from "@/components/feedback/spinner";
import { AddParticipantTurnForm } from "@/components/campaigns/add-participant-turn-form";
import {
  campaignApi,
  campaignKeys,
  type BalanceResult,
  type CampaignDetail,
  type ParticipantTurn,
} from "@/src/lib/api/campaign";
import { ApiError } from "@/src/lib/api/client";
import { useAuth } from "@/components/providers/auth-provider";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/feedback/pending-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuccessClose } from "@/hooks/use-success-close";

type Props = {
  campaign: CampaignDetail;
};

export function ParticipantTurnsTable({ campaign }: Props) {
  const t = useTranslations("campaigns.detail");
  const { isOwner } = useAuth();
  const campaignId = campaign.id;
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTurn, setDeleteTurn] = useState<ParticipantTurn | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const confirmedParticipants = campaign.participants.filter(
    (p) => (p.status ?? "CONFIRMED") === "CONFIRMED"
  );

  const expectedBagsByParticipantId = useMemo(
    () => new Map(campaign.participants.map((p) => [p.id, p.totalBagsPurchased])),
    [campaign.participants]
  );

  /**
   * US-38 AC #13 (v5.4): the save has already succeeded by the time this runs — a mismatch
   * is purely informational, never an error to react to or offer to undo.
   */
  const reportBalance = (result: BalanceResult) => {
    if (result.isBalanced) return;
    const expected = expectedBagsByParticipantId.get(result.campaignParticipantId) ?? 0;
    const sum = expected + result.difference;
    setWarning(
      t("turnMismatchWarning", {
        sum,
        expected,
        name: result.customerName,
        diff: Math.abs(result.difference),
      })
    );
  };

  const turnsQuery = useQuery({
    queryKey: campaignKeys.participantTurns(campaignId),
    queryFn: () => campaignApi.listParticipantTurns(campaignId),
  });

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
          {t("turnsTitle")}
        </h2>
        {isOwner && confirmedParticipants.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setAddOpen(true)}
          >
            {t("addTurnManually")}
          </Button>
        )}
      </div>

      {warning && (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/35 bg-card px-3 py-2.5 text-sm">
          <AlertTriangleIcon
            className="mt-0.5 size-4 shrink-0 text-amber-700"
            aria-hidden
          />
          <span className="flex-1">{warning}</span>
          <button
            type="button"
            onClick={() => setWarning(null)}
            aria-label={t("turnWarningDismiss")}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}

      {turnsQuery.isLoading && (
        <div className="space-y-2" aria-busy="true" aria-label={t("turnsLoading")}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      )}

      {turnsQuery.isError && (
        <QueryErrorState
          message={
            turnsQuery.error instanceof Error
              ? turnsQuery.error.message
              : t("turnsLoadError")
          }
          onRetry={() => turnsQuery.refetch()}
        />
      )}

      {turnsQuery.isSuccess && turnsQuery.data.length === 0 && (
        <Card className="border-border/70 bg-muted/20">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("turnsEmpty")}
          </CardContent>
        </Card>
      )}

      {turnsQuery.isSuccess && turnsQuery.data.length > 0 && (
        <div className="fk-table-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[4rem]">{t("turnNumber")}</TableHead>
                <TableHead>{t("turnCustomer")}</TableHead>
                <TableHead className="w-[5.5rem] text-right">
                  {t("turnBagCount")}
                </TableHead>
                <TableHead className="text-right">{t("turnNote")}</TableHead>
                {isOwner && (
                  <TableHead className="w-[2.5rem]">
                    <span className="sr-only">{t("turnActions")}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {turnsQuery.data.map((turn) => (
                <TableRow key={turn.id}>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {turn.turnNumber}
                  </TableCell>
                  <TableCell className="max-w-0 truncate font-medium">
                    {turn.customerName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {isOwner ? (
                      <TurnBagCountCell
                        campaignId={campaignId}
                        turn={turn}
                        onBalanceChecked={reportBalance}
                      />
                    ) : (
                      turn.bagCount
                    )}
                  </TableCell>
                  <TableCell className="min-w-[10rem] text-right">
                    <TurnNoteCell campaignId={campaignId} turn={turn} />
                  </TableCell>
                  {isOwner && (
                    <TableCell>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="size-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeleteTurn(turn)}
                        aria-label={t("turnDelete")}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isOwner && (
        <AddParticipantTurnForm
          key={addOpen ? "add-turn-open" : "add-turn-closed"}
          open={addOpen}
          onOpenChange={setAddOpen}
          campaign={campaign}
          confirmedParticipants={confirmedParticipants}
          onBalanceChecked={reportBalance}
        />
      )}

      {isOwner && deleteTurn && (
        <DeleteTurnDialog
          campaignId={campaignId}
          turn={deleteTurn}
          open={!!deleteTurn}
          onOpenChange={(next) => {
            if (!next) setDeleteTurn(null);
          }}
          onBalanceChecked={reportBalance}
        />
      )}
    </section>
  );
}

function TurnBagCountCell({
  campaignId,
  turn,
  onBalanceChecked,
}: {
  campaignId: string;
  turn: ParticipantTurn;
  onBalanceChecked: (result: BalanceResult) => void;
}) {
  const t = useTranslations("campaigns.detail");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(turn.bagCount));

  const mutation = useMutation({
    mutationFn: (bagCount: number) =>
      campaignApi.updateParticipantTurnBagCount(turn.id, { bagCount }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        campaignKeys.participantTurns(campaignId),
        (current: ParticipantTurn[] | undefined) =>
          (current ?? []).map((row) => (row.id === updated.id ? updated : row))
      );
      setEditing(false);
      onBalanceChecked({
        isBalanced: updated.isBalanced,
        difference: updated.difference,
        campaignParticipantId: updated.campaignParticipantId,
        customerName: updated.customerName,
      });
    },
  });

  const startEditing = () => {
    setDraft(String(turn.bagCount));
    setEditing(true);
  };

  const commit = () => {
    const value = Number(draft);
    if (!draft || Number.isNaN(value) || !Number.isInteger(value) || value < 1) {
      setDraft(String(turn.bagCount));
      setEditing(false);
      return;
    }
    if (value === turn.bagCount) {
      setEditing(false);
      return;
    }
    mutation.mutate(value);
  };

  const cancel = () => {
    setDraft(String(turn.bagCount));
    setEditing(false);
  };

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("turnBagCountUpdateFailed")
        : null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="block w-full min-w-0 rounded px-1.5 py-1 text-right tabular-nums transition-colors hover:bg-muted/60"
      >
        {turn.bagCount}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {mutation.isPending && <Spinner className="size-3.5 shrink-0" />}
        <Input
          autoFocus
          type="number"
          min={1}
          inputMode="numeric"
          value={draft}
          disabled={mutation.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 w-20 text-right"
        />
      </div>
      {errorMessage && (
        <p className="max-w-[14rem] text-right text-[0.7rem] text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

function TurnNoteCell({
  campaignId,
  turn,
}: {
  campaignId: string;
  turn: ParticipantTurn;
}) {
  const t = useTranslations("campaigns.detail");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(turn.note ?? "");

  const mutation = useMutation({
    mutationFn: (note: string) =>
      campaignApi.updateParticipantTurnNote(turn.id, {
        note: note.trim() === "" ? null : note,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        campaignKeys.participantTurns(campaignId),
        (current: ParticipantTurn[] | undefined) =>
          (current ?? []).map((row) => (row.id === updated.id ? updated : row))
      );
      setEditing(false);
    },
  });

  const startEditing = () => {
    setDraft(turn.note ?? "");
    setEditing(true);
  };

  const commit = () => {
    const trimmed = draft.trim();
    const current = turn.note ?? "";
    if (trimmed === current) {
      setEditing(false);
      return;
    }
    mutation.mutate(draft);
  };

  const cancel = () => {
    setDraft(turn.note ?? "");
    setEditing(false);
  };

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("turnNoteUpdateFailed")
        : null;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="block w-full min-w-0 truncate rounded px-1.5 py-1 text-right text-sm transition-colors hover:bg-muted/60"
      >
        {turn.note?.trim() ? (
          turn.note
        ) : (
          <span className="text-muted-foreground">{t("turnNotePlaceholder")}</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Input
          autoFocus
          value={draft}
          maxLength={500}
          disabled={mutation.isPending}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          className="h-8 text-right"
        />
        {mutation.isPending && <Spinner className="size-3.5 shrink-0" />}
      </div>
      {errorMessage && (
        <p className="text-right text-[0.7rem] text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

function DeleteTurnDialog({
  campaignId,
  turn,
  open,
  onOpenChange,
  onBalanceChecked,
}: {
  campaignId: string;
  turn: ParticipantTurn;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBalanceChecked: (result: BalanceResult) => void;
}) {
  const t = useTranslations("campaigns.detail");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const mutation = useMutation({
    mutationFn: () => campaignApi.deleteParticipantTurn(turn.id),
    onSuccess: async (result) => {
      queryClient.setQueryData(
        campaignKeys.participantTurns(campaignId),
        (current: ParticipantTurn[] | undefined) =>
          (current ?? []).filter((row) => row.id !== turn.id)
      );
      onBalanceChecked({
        isBalanced: result.isBalanced,
        difference: result.difference,
        campaignParticipantId: result.campaignParticipantId,
        customerName: turn.customerName,
      });
      await runSuccess(() => onOpenChange(false));
    },
  });

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("turnDeleteFailed")
        : null;

  const locked = mutation.isPending || succeeded;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("turnDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              {t("turnDeleteDescription", {
                name: turn.customerName,
                bagCount: turn.bagCount,
              })}
            </span>
            {errorMessage && (
              <span className="block text-destructive">{errorMessage}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            {tCommon("actions.cancel")}
          </AlertDialogCancel>
          <PendingButton
            type="button"
            variant="destructive"
            pending={mutation.isPending}
            success={succeeded}
            pendingLabel={tCommon("pending.deleting")}
            onClick={() => mutation.mutate()}
          >
            {t("turnDeleteConfirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
