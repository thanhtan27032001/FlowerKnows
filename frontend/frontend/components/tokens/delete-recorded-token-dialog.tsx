"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { campaignKeys } from "@/src/lib/api/campaign";
import { customerKeys } from "@/src/lib/api/customer";
import { tokenApi, tokenKeys } from "@/src/lib/api/token";
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
  productName?: string;
  customerId?: string;
  campaignId?: string;
  participantId?: string;
  onSuccess?: () => void;
};

export function DeleteRecordedTokenDialog({
  open,
  onOpenChange,
  tokenId,
  productName,
  customerId,
  campaignId,
  participantId,
  onSuccess,
}: Props) {
  const t = useTranslations("tokens.deleteRecordedDialog");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const mutation = useMutation({
    mutationFn: () => tokenApi.deleteRecorded(tokenId),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: tokenKeys.all });
      if (customerId) {
        void queryClient.invalidateQueries({
          queryKey: customerKeys.detail(customerId),
        });
      } else {
        void queryClient.invalidateQueries({ queryKey: customerKeys.all });
      }
      if (campaignId) {
        void queryClient.invalidateQueries({
          queryKey: campaignKeys.detail(campaignId),
        });
        if (participantId) {
          void queryClient.invalidateQueries({
            queryKey: campaignKeys.participantTokens(campaignId, participantId),
          });
        }
      } else {
        void queryClient.invalidateQueries({ queryKey: campaignKeys.all });
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
            <span className="block">{t("description")}</span>
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
            {t("confirm")}
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
