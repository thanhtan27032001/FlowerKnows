"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  exchangeApi,
  exchangeErrorMessage,
  exchangeKeys,
  type ExchangeHistoryItem,
} from "@/src/lib/api/exchange";
import { customerKeys } from "@/src/lib/api/customer";
import { productKeys } from "@/src/lib/api/product";
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
  exchange: ExchangeHistoryItem;
  customerId: string;
  onSuccess?: () => void;
};

function productSummary(tokens: { productName: string }[]) {
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok.productName, (counts.get(tok.productName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");
}

export function UndoExchangeDialog({
  open,
  onOpenChange,
  exchange,
  customerId,
  onSuccess,
}: Props) {
  const t = useTranslations("exchange.undoDialog");
  const tErrors = useTranslations("exchange.errors");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const disappear = productSummary(exchange.tokensOut);
  const restore = productSummary(exchange.tokensIn);

  const mutation = useMutation({
    mutationFn: () => exchangeApi.undo(exchange.id),
    onSuccess: async () => {
      void queryClient.invalidateQueries({
        queryKey: exchangeKeys.byCustomer(customerId),
      });
      void queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        onSuccess?.();
      });
    },
  });

  const locked = mutation.isPending || succeeded;
  const errorMessage = mutation.isError
    ? exchangeErrorMessage(mutation.error, t("failed"), tErrors)
    : null;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            <span className="block">{t("intro")}</span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block font-medium">{t("willDisappear")}</span>
              <span className="mt-0.5 block">{disappear || t("none")}</span>
            </span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block font-medium">{t("willRestore")}</span>
              <span className="mt-0.5 block">{restore || t("none")}</span>
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
