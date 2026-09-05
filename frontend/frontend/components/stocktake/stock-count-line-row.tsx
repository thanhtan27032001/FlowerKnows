"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  stockCountApi,
  stockCountKeys,
  type StockCountLine,
} from "@/src/lib/api/stock-count";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/shared/status-badge";

type Props = {
  stockCountId: string;
  line: StockCountLine;
  readOnly: boolean;
};

export function StockCountLineRow({ stockCountId, line, readOnly }: Props) {
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

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });

  const updateMutation = useMutation({
    mutationFn: (input: Parameters<typeof stockCountApi.updateLine>[2]) =>
      stockCountApi.updateLine(stockCountId, line.id, input),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: () => stockCountApi.removeLine(stockCountId, line.id),
    onSuccess: invalidate,
  });

  const errorMessage =
    updateMutation.isError || removeMutation.isError
      ? updateMutation.error instanceof ApiError
        ? updateMutation.error.message
        : removeMutation.error instanceof ApiError
          ? removeMutation.error.message
          : t("saveFailed")
      : null;

  const countedNum = counted.trim() === "" ? null : Number(counted);
  const diff =
    countedNum != null && Number.isFinite(countedNum)
      ? countedNum - line.systemQuantityAtAdd
      : null;
  const showCostPrice = diff != null && diff > 0;

  const saveCounted = () => {
    if (countedNum == null || !Number.isFinite(countedNum) || countedNum < 0) return;
    if (countedNum === line.countedQuantity) return;
    updateMutation.mutate({ countedQuantity: countedNum });
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

  const diffBadge =
    diff == null ? (
      <StatusBadge variant="neutral">{t("notCounted")}</StatusBadge>
    ) : diff === 0 ? (
      <StatusBadge variant="neutral">{t("match")}</StatusBadge>
    ) : diff > 0 ? (
      <StatusBadge variant="success">{t("diffMore", { count: diff })}</StatusBadge>
    ) : (
      <StatusBadge variant="danger">{t("diffLess", { count: Math.abs(diff) })}</StatusBadge>
    );

  return (
    <fieldset
      disabled={readOnly}
      className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{line.productName}</p>
          <p className="text-xs text-muted-foreground">
            {t("systemQuantity")}: {line.systemQuantityAtAdd}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {diffBadge}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => removeMutation.mutate()}
              aria-label={t("removeLine")}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </div>

      <div className="grid items-start gap-3 sm:grid-cols-2">
        <div className="grid content-start gap-1.5">
          <Label htmlFor={`counted-${line.id}`}>{t("countedQuantity")}</Label>
          <Input
            id={`counted-${line.id}`}
            type="number"
            min={0}
            inputMode="numeric"
            placeholder={t("countedPlaceholder")}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            onBlur={saveCounted}
          />
        </div>
        {showCostPrice && (
          <div className="grid content-start gap-1.5">
            <Label htmlFor={`cost-${line.id}`}>{t("costPrice")}</Label>
            <Input
              id={`cost-${line.id}`}
              type="number"
              min={1}
              inputMode="numeric"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              onBlur={saveCostPrice}
            />
            <p className="text-xs text-muted-foreground">{t("costPriceHint")}</p>
          </div>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`note-${line.id}`}>{t("note")}</Label>
        <Input
          id={`note-${line.id}`}
          value={note}
          placeholder={t("notePlaceholder")}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
      {!errorMessage && (updateMutation.isPending || removeMutation.isPending) && (
        <p className="text-xs text-muted-foreground">{tCommon("pending.saving")}</p>
      )}
    </fieldset>
  );
}
