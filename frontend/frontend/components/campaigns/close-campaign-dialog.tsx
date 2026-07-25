"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { campaignApi, campaignKeys } from "@/src/lib/api/campaign";
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
};

export function CloseCampaignDialog({
  campaignId,
  open,
  onOpenChange,
  onClosed,
}: Props) {
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const {
    data: preview,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: campaignKeys.closePreview(campaignId),
    queryFn: () => campaignApi.closePreview(campaignId),
    enabled: open,
  });

  const closeMutation = useMutation({
    mutationFn: () => campaignApi.close(campaignId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        onClosed?.();
      });
    },
  });

  const locked = closeMutation.isPending || succeeded;

  const mutationError =
    closeMutation.error instanceof ApiError
      ? closeMutation.error.message
      : closeMutation.isError
        ? "Failed to close campaign"
        : null;

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close Campaign</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left">
            {isLoading && <span>Loading return preview…</span>}

            {isError && (
              <span className="text-destructive">
                {error instanceof Error
                  ? error.message
                  : "Failed to load close preview"}
              </span>
            )}

            {preview && (
              <>
                <span className="block">{preview.message}</span>
                {preview.productsToReturn.length > 0 ? (
                  <ul className="mt-2 space-y-1 rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-foreground">
                    {preview.productsToReturn.map((item) => (
                      <li
                        key={item.productId}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{item.productName}</span>
                        <span className="tabular-nums font-medium">
                          +{item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="mt-1 block text-sm text-muted-foreground">
                    Nothing will be returned to stock.
                  </span>
                )}
              </>
            )}

            {mutationError && (
              <span className="block text-destructive">{mutationError}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={locked}>Cancel</AlertDialogCancel>
          <PendingButton
            type="button"
            pending={closeMutation.isPending}
            success={succeeded}
            pendingLabel="Closing…"
            disabled={isLoading || isError || !preview}
            onClick={() => {
              closeMutation.mutate();
            }}
          >
            Confirm close
          </PendingButton>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
