"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerKeys, type CustomerToken } from "@/src/lib/api/customer";
import { campaignKeys } from "@/src/lib/api/campaign";
import { exchangeApi, exchangeErrorMessage } from "@/src/lib/api/exchange";
import { productApi, productKeys } from "@/src/lib/api/product";
import { vnd } from "@/src/lib/format";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tokens: CustomerToken[];
  onSuccess?: () => void;
};

export function CashOutForm({
  open,
  onOpenChange,
  customerId,
  tokens,
  onSuccess,
}: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  // null = still following suggested; string = staff override
  const [actualRefund, setActualRefund] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
    enabled: open,
  });

  const suggestedRefund = useMemo(() => {
    const priceById = new Map(products.map((p) => [p.id, p.listPrice]));
    return tokens.reduce((sum, t) => sum + (priceById.get(t.productId) ?? 0), 0);
  }, [products, tokens]);

  const refundDisplay =
    actualRefund ?? (products.length > 0 ? String(suggestedRefund) : "");

  const resetForm = () => {
    setActualRefund(null);
    setFormError(null);
    setFieldError(null);
  };

  const mutation = useMutation({
    mutationFn: exchangeApi.cashOut,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        resetForm();
        onSuccess?.();
      });
    },
    onError: (err: unknown) => {
      setFormError(exchangeErrorMessage(err, "Cash out failed"));
    },
  });

  const locked = mutation.isPending || succeeded;

  const validateAndSubmit = () => {
    setFormError(null);
    const amount = Number(refundDisplay);
    if (refundDisplay === "" || Number.isNaN(amount) || amount < 0) {
      setFieldError("Actual refund amount must be a number ≥ 0");
      return;
    }
    setFieldError(null);

    mutation.mutate({
      customerId,
      tokenIds: tokens.map((t) => t.id),
      actualRefundAmount: amount,
    });
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      resetForm();
    }
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Cashing out ({tokens.length} token{tokens.length === 1 ? "" : "s"})
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {tokens.map((t) => {
            const listPrice =
              products.find((p) => p.id === t.productId)?.listPrice ?? null;
            return (
              <li key={t.id} className="flex justify-between gap-3">
                <span className="truncate">{t.productName}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  list {listPrice != null ? vnd.format(listPrice) : "…"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border border-border/80 bg-background p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Suggested refund</span>
          <span className="font-medium tabular-nums">
            {products.length > 0 ? vnd.format(suggestedRefund) : "…"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Sum of product list prices (editable below)
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="actual-refund">Actual refund amount (VND)</Label>
        <Input
          id="actual-refund"
          type="number"
          min={0}
          inputMode="numeric"
          value={refundDisplay}
          onChange={(e) => setActualRefund(e.target.value)}
          aria-invalid={!!fieldError}
        />
        {fieldError && (
          <p className="text-xs text-destructive">{fieldError}</p>
        )}
      </div>

      {formError && (
        <p
          className={
            formError.startsWith("Conflict:")
              ? "rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
              : "text-sm text-destructive"
          }
        >
          {formError}
        </p>
      )}
    </fieldset>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => handleOpenChange(false)}
      >
        Cancel
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel="Confirming…"
        disabled={tokens.length === 0}
        onClick={validateAndSubmit}
      >
        Confirm Cash Out
      </PendingButton>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Cash Out</SheetTitle>
            <SheetDescription>
              Refund selected tokens. Suggested amount uses product list prices.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cash Out</DialogTitle>
          <DialogDescription>
            Refund selected tokens. Suggested amount uses product list prices.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
