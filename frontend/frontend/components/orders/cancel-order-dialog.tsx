"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { customerKeys } from "@/src/lib/api/customer";
import { orderApi, orderKeys } from "@/src/lib/api/order";
import { reportKeys } from "@/src/lib/api/report";
import { vnd } from "@/src/lib/format";
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
  orderId: string;
  customerId: string;
  recognizedRevenue: number;
  tokenCount: number;
};

export function CancelOrderDialog({
  open,
  onOpenChange,
  orderId,
  customerId,
  recognizedRevenue,
  tokenCount,
}: Props) {
  const t = useTranslations("orders.cancelDialog");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const mutation = useMutation({
    mutationFn: () => orderApi.cancel(orderId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orderKeys.all }),
        queryClient.invalidateQueries({ queryKey: reportKeys.all }),
        queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customerId),
        }),
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
              <span className="block font-medium">{t("willRestoreTokens")}</span>
              <span className="mt-0.5 block tabular-nums">
                {t("itemsCount", { count: tokenCount })}
              </span>
            </span>
            <span className="block rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground">
              <span className="block font-medium">{t("willRemoveRevenue")}</span>
              <span className="mt-0.5 block tabular-nums">
                −{vnd.format(recognizedRevenue)}
              </span>
            </span>
            {errorMessage && (
              <span className="block text-sm text-destructive">
                {errorMessage}
              </span>
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
            pendingLabel={tCommon("pending.cancelling")}
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
