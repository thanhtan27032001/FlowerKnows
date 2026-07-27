"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type PoolItem,
} from "@/src/lib/api/campaign";
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
  campaignId: string;
  pool: PoolItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReopened?: () => void;
};

export function ReopenCampaignDialog({
  campaignId,
  pool,
  open,
  onOpenChange,
  onReopened,
}: Props) {
  const t = useTranslations("campaigns.reopen");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const productsToRelock = useMemo(
    () =>
      pool
        .filter((item) => item.remainingQuantity > 0)
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.remainingQuantity,
        })),
    [pool]
  );

  const reopenMutation = useMutation({
    mutationFn: () => campaignApi.reopen(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        onReopened?.();
      });
    },
  });

  const locked = reopenMutation.isPending || succeeded;

  const mutationError =
    reopenMutation.error instanceof ApiError
      ? reopenMutation.error.message
      : reopenMutation.isError
        ? t("failed")
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
          <AlertDialogDescription
            className="space-y-3 text-left"
            render={<div />}
          >
            {productsToRelock.length > 0 ? (
              <>
                <span className="block">{t("summary")}</span>
                <ul className="mt-2 space-y-1 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-foreground">
                  {productsToRelock.map((item) => (
                    <li
                      key={item.productId}
                      className="flex items-center justify-between gap-3"
                    >
                      <span>{item.productName}</span>
                      <span className="tabular-nums font-medium">
                        −{item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <span className="block">{t("nothingToRelock")}</span>
            )}

            {mutationError && (
              <span className="block text-destructive">{mutationError}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            {tCommon("actions.cancel")}
          </AlertDialogCancel>
          <PendingButton
            type="button"
            pending={reopenMutation.isPending}
            success={succeeded}
            pendingLabel={tCommon("pending.reopening")}
            onClick={() => {
              reopenMutation.mutate();
            }}
          >
            {t("confirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
