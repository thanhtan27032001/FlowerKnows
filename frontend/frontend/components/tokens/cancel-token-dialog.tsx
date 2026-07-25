"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { customerKeys } from "@/src/lib/api/customer";
import { productKeys } from "@/src/lib/api/product";
import { reportKeys } from "@/src/lib/api/report";
import { tokenApi, tokenKeys } from "@/src/lib/api/token";
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
  tokenId: string;
  tokenValue: number;
  productName?: string;
  customerId?: string;
  onSuccess?: () => void;
};

export function CancelTokenDialog({
  open,
  onOpenChange,
  tokenId,
  tokenValue,
  productName,
  customerId,
  onSuccess,
}: Props) {
  const t = useTranslations("alerts.cancelDialog");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const mutation = useMutation({
    mutationFn: () => tokenApi.cancel(tokenId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: tokenKeys.all });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
      if (customerId) {
        await queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customerId),
        });
      } else {
        await queryClient.invalidateQueries({ queryKey: customerKeys.all });
      }
      await runSuccess(() => {
        onOpenChange(false);
        onSuccess?.();
      });
    },
  });

  const locked = mutation.isPending || succeeded;

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
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
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              {t("description", { value: vnd.format(tokenValue) })}
            </span>
            {productName && (
              <span className="block text-sm text-foreground">
                {t("product", { name: productName })}
              </span>
            )}
            {errorMessage && (
              <span className="block text-destructive">{errorMessage}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>
            {tCommon("actions.keepToken")}
          </AlertDialogCancel>
          <PendingButton
            type="button"
            pending={mutation.isPending}
            success={succeeded}
            pendingLabel={tCommon("pending.cancelling")}
            onClick={() => {
              mutation.mutate();
            }}
          >
            {t("confirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
