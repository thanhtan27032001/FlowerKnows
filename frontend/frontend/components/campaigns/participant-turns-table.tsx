"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { Spinner } from "@/components/feedback/spinner";
import {
  campaignApi,
  campaignKeys,
  type ParticipantTurn,
} from "@/src/lib/api/campaign";
import { ApiError } from "@/src/lib/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  campaignId: string;
};

export function ParticipantTurnsTable({ campaignId }: Props) {
  const t = useTranslations("campaigns.detail");

  const turnsQuery = useQuery({
    queryKey: campaignKeys.participantTurns(campaignId),
    queryFn: () => campaignApi.listParticipantTurns(campaignId),
  });

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
        {t("turnsTitle")}
      </h2>

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
                    {turn.bagCount}
                  </TableCell>
                  <TableCell className="min-w-[10rem] text-right">
                    <TurnNoteCell campaignId={campaignId} turn={turn} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
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
