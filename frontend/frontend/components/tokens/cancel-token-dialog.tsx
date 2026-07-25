"use client";

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
        ? "Failed to cancel token"
        : null;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Token</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span className="block">
              Cancelling this token will: return the product to general stock and
              immediately recognize {vnd.format(tokenValue)} as revenue. Confirm?
            </span>
            {productName && (
              <span className="block text-sm text-foreground">
                Product: {productName}
              </span>
            )}
            {errorMessage && (
              <span className="block text-destructive">{errorMessage}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>Keep token</AlertDialogCancel>
          <PendingButton
            type="button"
            pending={mutation.isPending}
            success={succeeded}
            pendingLabel="Cancelling…"
            onClick={() => {
              mutation.mutate();
            }}
          >
            Confirm cancel
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
