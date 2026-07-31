"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  productKeys,
  type StockTransaction,
} from "@/src/lib/api/product";
import { stockLedgerApi, stockLedgerKeys } from "@/src/lib/api/stock-ledger";
import { reportKeys } from "@/src/lib/api/report";
import { formatCostPrice } from "@/src/lib/format";
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
  transaction: StockTransaction;
  productId: string;
};

export function UndoStockInDialog({
  open,
  onOpenChange,
  transaction,
  productId,
}: Props) {
  const t = useTranslations("products.history.undoDialog");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const avgBeforeLabel =
    transaction.averageCostPriceBefore == null
      ? t("avgCostUnset")
      : formatCostPrice(
          transaction.averageCostPriceBefore,
          tCommon("format.notSet")
        );

  const mutation = useMutation({
    mutationFn: () => stockLedgerApi.undoStockIn(transaction.id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: productKeys.transactions(productId),
        }),
        queryClient.invalidateQueries({
          queryKey: productKeys.detail(productId),
        }),
        queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: stockLedgerKeys.all }),
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

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">{t("intro")}</span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block font-medium">{t("stockWillDecrease")}</span>
              <span className="mt-0.5 block tabular-nums">
                −{transaction.quantityChange}
              </span>
            </span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block font-medium">{t("avgCostWillRevert")}</span>
              <span className="mt-0.5 block tabular-nums">{avgBeforeLabel}</span>
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
            pendingLabel={tCommon("pending.confirming")}
            onClick={() => mutation.mutate()}
          >
            {t("confirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
