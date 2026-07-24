"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { campaignApi, campaignKeys } from "@/src/lib/api/campaign";
import { productKeys } from "@/src/lib/api/product";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
      onOpenChange(false);
      onClosed?.();
    },
  });

  const mutationError =
    closeMutation.error instanceof ApiError
      ? closeMutation.error.message
      : closeMutation.isError
        ? "Failed to close campaign"
        : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
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
          <AlertDialogCancel disabled={closeMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={
              isLoading || isError || !preview || closeMutation.isPending
            }
            onClick={(e) => {
              e.preventDefault();
              closeMutation.mutate();
            }}
          >
            {closeMutation.isPending ? "Closing…" : "Confirm close"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
