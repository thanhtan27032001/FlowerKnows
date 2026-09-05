"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import type { Product } from "@/src/lib/api/product";
import { reportKeys } from "@/src/lib/api/report";
import { productKeys } from "@/src/lib/api/product";
import {
  stockCountApi,
  stockCountKeys,
  type StockCountDetail,
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
import { useSuccessClose } from "@/hooks/use-success-close";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stockCount: StockCountDetail;
  products: Product[];
};

export function CompleteStockCountDialog({
  open,
  onOpenChange,
  stockCount,
  products,
}: Props) {
  const t = useTranslations("stocktake.completeDialog");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const productsById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const summary = useMemo(() => {
    let counted = 0;
    let discrepancies = 0;
    let netEffect = 0;
    for (const line of stockCount.lines) {
      if (line.countedQuantity == null) continue;
      counted += 1;
      const liveStock =
        productsById.get(line.productId)?.stockQuantity ?? line.systemQuantityAtAdd;
      const delta = line.countedQuantity - liveStock;
      if (delta !== 0) {
        discrepancies += 1;
        netEffect += delta;
      }
    }
    return { total: stockCount.lines.length, counted, discrepancies, netEffect };
  }, [stockCount.lines, productsById]);

  const mutation = useMutation({
    mutationFn: () => stockCountApi.complete(stockCount.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: stockCountKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: reportKeys.all }),
      ]);
      await runSuccess(() => {
        onOpenChange(false);
      });
    },
  });

  const locked = mutation.isPending || succeeded;
  const errorMessage =
    mutation.isError && mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("failed")
        : null;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      mutation.reset();
    }
  };

  const netEffectLabel =
    summary.netEffect === 0
      ? t("netZero")
      : summary.netEffect > 0
        ? t("netIncrease", { count: summary.netEffect })
        : t("netDecrease", { count: summary.netEffect });

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">{t("description")}</span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block">
                {t("countedSummary", { counted: summary.counted, total: summary.total })}
              </span>
              <span className="mt-1 block">
                {t("discrepancySummary", { count: summary.discrepancies })}
              </span>
              <span className="mt-1 block font-medium">
                {t("netEffect")}: {netEffectLabel}
              </span>
            </span>
            {errorMessage && (
              <span className="block text-sm text-destructive">{errorMessage}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            {tCommon("actions.cancel")}
          </AlertDialogCancel>
          <PendingButton
            type="button"
            pending={mutation.isPending}
            success={succeeded}
            pendingLabel={tCommon("pending.confirming")}
            disabled={locked}
            onClick={() => mutation.mutate()}
          >
            {t("confirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
