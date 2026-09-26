"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDownIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  stockCountApi,
  stockCountKeys,
  type StockCountLine,
  type UpdateStockCountLineInput,
} from "@/src/lib/api/stock-count";
import { PendingButton } from "@/components/feedback/pending-button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";

/** Product | Thực đếm | actions — shared with the column caption above the list. */
export const STOCK_COUNT_COMPACT_GRID = "grid grid-cols-[minmax(0,1fr)_5rem_4.5rem]";

export const countedInputId = (lineId: string) => `counted-${lineId}`;

/** Counted-vs-system badge; `diff` is null while the line is not counted yet. */
export function StockCountDiffBadge({ diff }: { diff: number | null }) {
  const t = useTranslations("stocktake.detail");
  if (diff == null) return <StatusBadge variant="neutral">{t("notCounted")}</StatusBadge>;
  if (diff === 0) return <StatusBadge variant="neutral">{t("match")}</StatusBadge>;
  if (diff > 0) {
    return <StatusBadge variant="success">{t("diffMore", { count: diff })}</StatusBadge>;
  }
  return <StatusBadge variant="danger">{t("diffLess", { count: Math.abs(diff) })}</StatusBadge>;
}

type Props = {
  stockCountId: string;
  line: StockCountLine;
  readOnly: boolean;
  /** Called after Enter in the counted-quantity field so the parent can move focus. */
  onAdvance?: (lineId: string) => void;
};

export function StockCountLineRow({
  stockCountId,
  line,
  readOnly,
  onAdvance,
}: Props) {
  const t = useTranslations("stocktake.detail");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [counted, setCounted] = useState(
    line.countedQuantity != null ? String(line.countedQuantity) : ""
  );
  const [costPrice, setCostPrice] = useState(
    line.costPrice != null ? String(line.costPrice) : ""
  );
  const [note, setNote] = useState(line.note ?? "");
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  // Compact by default; lines that already carry a cost price or note start open.
  const [expanded, setExpanded] = useState(
    line.costPrice != null || !!line.note?.trim()
  );
  // Guards against Enter + the blur that follows it both firing the same save.
  const lastSentCounted = useRef<number | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateStockCountLineInput) =>
      stockCountApi.updateLine(stockCountId, line.id, input),
    onSuccess: invalidate,
    onError: () => {
      lastSentCounted.current = null;
      toast.error(t("saveFailedToast", { product: line.productName }));
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => stockCountApi.removeLine(stockCountId, line.id),
    onSuccess: invalidate,
    onError: () => {
      toast.error(t("removeFailedToast", { product: line.productName }));
    },
  });

  const failedError = updateMutation.isError
    ? updateMutation.error
    : removeMutation.isError
      ? removeMutation.error
      : null;
  const errorMessage = failedError
    ? failedError instanceof ApiError
      ? failedError.message
      : t("saveFailed")
    : null;

  const countedNum = counted.trim() === "" ? null : Number(counted);
  const diff =
    countedNum != null && Number.isFinite(countedNum)
      ? countedNum - line.systemQuantityAtAdd
      : null;
  const showCostPrice = diff != null && diff > 0;

  const isValidCounted = (value: number | null): value is number =>
    value != null && Number.isFinite(value) && value >= 0;

  /** Returns false when the typed value is invalid (so Enter should not advance). */
  const saveCounted = () => {
    if (countedNum == null) return true;
    if (!isValidCounted(countedNum)) return false;
    if (countedNum === line.countedQuantity && !updateMutation.isError) return true;
    if (countedNum === lastSentCounted.current) return true;
    lastSentCounted.current = countedNum;
    updateMutation.mutate({ countedQuantity: countedNum });
    return true;
  };

  const saveCostPrice = () => {
    const trimmed = costPrice.trim();
    if (trimmed === "") return;
    const value = Number(trimmed);
    if (!Number.isFinite(value) || value <= 0) return;
    if (value === line.costPrice) return;
    updateMutation.mutate({ costPrice: value });
  };

  const saveNote = () => {
    const trimmed = note.trim();
    if (trimmed === (line.note ?? "")) return;
    updateMutation.mutate({ note: trimmed });
  };

  const onCountedKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (saveCounted()) onAdvance?.(line.id);
  };

  /** Re-send the failed field(s) using whatever is currently in the inputs. */
  const retry = () => {
    if (removeMutation.isError) {
      removeMutation.mutate();
      return;
    }
    const failed = updateMutation.variables;
    if (!failed) return;
    const input: UpdateStockCountLineInput = {};
    if ("countedQuantity" in failed && isValidCounted(countedNum)) {
      input.countedQuantity = countedNum;
      lastSentCounted.current = countedNum;
    }
    if ("costPrice" in failed) {
      const value = Number(costPrice.trim());
      if (costPrice.trim() !== "" && Number.isFinite(value) && value > 0) {
        input.costPrice = value;
      }
    }
    if ("note" in failed) input.note = note.trim();
    updateMutation.mutate(Object.keys(input).length > 0 ? input : failed);
  };

  const dismissError = () => {
    updateMutation.reset();
    removeMutation.reset();
  };

  const hasData =
    line.countedQuantity != null ||
    line.costPrice != null ||
    !!line.note?.trim() ||
    counted.trim() !== "" ||
    costPrice.trim() !== "" ||
    note.trim() !== "";

  const requestRemove = () => {
    if (hasData) setConfirmRemoveOpen(true);
    else removeMutation.mutate();
  };

  const diffBadge = <StockCountDiffBadge diff={diff} />;

  return (
    <fieldset
      disabled={readOnly}
      data-line-id={line.id}
      aria-invalid={!!errorMessage || undefined}
      className={cn(
        "grid scroll-mt-24 gap-2 rounded-xl border border-border/80 bg-muted/20 px-3 py-2 transition-colors",
        errorMessage &&
          "border-destructive bg-destructive/5 ring-3 ring-destructive/20 dark:border-destructive/60 dark:ring-destructive/40"
      )}
    >
      <div className={cn("items-center gap-2", STOCK_COUNT_COMPACT_GRID)}>
        <div className="min-w-0">
          <p className="truncate font-medium" title={line.productName}>
            {line.productName}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
            <span>
              {t("systemQuantity")}: {line.systemQuantityAtAdd}
            </span>
            {diffBadge}
          </div>
        </div>
        <Input
          id={countedInputId(line.id)}
          type="number"
          min={0}
          inputMode="numeric"
          enterKeyHint="next"
          aria-label={`${t("countedQuantity")} — ${line.productName}`}
          placeholder={t("countedPlaceholder")}
          className="text-center"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          onBlur={saveCounted}
          onKeyDown={onCountedKeyDown}
        />
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={`line-extra-${line.id}`}
            aria-label={expanded ? t("collapseLine") : t("expandLine")}
          >
            <ChevronDownIcon className={cn("transition-transform", expanded && "rotate-180")} />
          </Button>
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={requestRemove}
              disabled={removeMutation.isPending}
              aria-label={t("removeLine")}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>

      {/* Cost price appears as soon as the count exceeds stock, even when collapsed,
          so a needed value is never hidden behind the toggle. */}
      {showCostPrice && (
        <div className="grid gap-1.5">
          <Label htmlFor={`cost-${line.id}`}>{t("costPrice")}</Label>
          <Input
            id={`cost-${line.id}`}
            type="number"
            min={1}
            inputMode="numeric"
            title={t("costPriceHint")}
            value={costPrice}
            onChange={(e) => setCostPrice(e.target.value)}
            onBlur={saveCostPrice}
          />
          <p className="text-xs text-muted-foreground">{t("costPriceHint")}</p>
        </div>
      )}

      {expanded && (
        <div id={`line-extra-${line.id}`} className="grid gap-1.5">
          <Label htmlFor={`note-${line.id}`}>{t("note")}</Label>
          <Input
            id={`note-${line.id}`}
            value={note}
            placeholder={t("notePlaceholder")}
            onChange={(e) => setNote(e.target.value)}
            onBlur={saveNote}
          />
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2"
        >
          <p className="min-w-0 flex-1 text-sm font-medium text-destructive">
            {errorMessage}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retry}
            disabled={updateMutation.isPending || removeMutation.isPending}
          >
            <RotateCcwIcon />
            {tCommon("actions.retry")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={dismissError}
            aria-label={t("dismissError")}
          >
            <XIcon />
          </Button>
        </div>
      )}
      {!errorMessage && (updateMutation.isPending || removeMutation.isPending) && (
        <p className="text-xs text-muted-foreground">
          {tCommon("pending.saving")}
        </p>
      )}

      {!readOnly && (
        <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("removeLineConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("removeLineConfirmDescription", { product: line.productName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon("actions.cancel")}</AlertDialogCancel>
              <PendingButton
                type="button"
                variant="destructive"
                pending={removeMutation.isPending}
                pendingLabel={tCommon("pending.deleting")}
                onClick={() => {
                  setConfirmRemoveOpen(false);
                  removeMutation.mutate();
                }}
              >
                {t("removeLineConfirm")}
              </PendingButton>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </fieldset>
  );
}
