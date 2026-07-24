"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { customerKeys, type CustomerToken } from "@/src/lib/api/customer";
import { orderApi, orderKeys } from "@/src/lib/api/order";
import { productKeys } from "@/src/lib/api/product";
import { formatCostPrice, formatDateTime, vnd, vndCost } from "@/src/lib/format";
import { Button } from "@/components/ui/button";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tokens: CustomerToken[];
  onSuccess?: () => void;
};

export function CreateOrderForm({
  open,
  onOpenChange,
  customerId,
  tokens,
  onSuccess,
}: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  // Display-only preview of figures the backend will persist on create (US-09 AC #1)
  const expectedRevenue = useMemo(
    () => tokens.reduce((sum, t) => sum + t.tokenValue, 0),
    [tokens]
  );
  const expectedTotalCost = useMemo(
    () => tokens.reduce((sum, t) => sum + (t.costBasis ?? 0), 0),
    [tokens]
  );
  const expectedGrossMargin = expectedRevenue - expectedTotalCost;

  const mutation = useMutation({
    mutationFn: orderApi.create,
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      onOpenChange(false);
      onSuccess?.();
      router.push(`/orders?highlight=${order.id}`);
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to create order"
      );
    },
  });

  const submit = () => {
    setFormError(null);
    mutation.mutate({
      customerId,
      tokenIds: tokens.map((t) => t.id),
    });
  };

  const formBody = (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Selected tokens ({tokens.length})
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">{t.productName}</span>
                <span className="text-xs text-muted-foreground">
                  {t.sourceLabel} · {formatDateTime(t.createdAt)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Cost basis {formatCostPrice(t.costBasis)}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block">{vnd.format(t.tokenValue)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 rounded-xl border border-border/80 bg-background p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Expected revenue</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vnd.format(expectedRevenue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected total cost</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vndCost.format(expectedTotalCost)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Expected gross margin</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vndCost.format(expectedGrossMargin)}
            </p>
          </div>
        </div>
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </div>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button
        type="button"
        disabled={mutation.isPending || tokens.length === 0}
        onClick={submit}
      >
        {mutation.isPending ? "Creating…" : "Confirm Create Order"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Create Order</SheetTitle>
            <SheetDescription>
              Merge selected holding tokens into one order and recognize revenue.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Order</DialogTitle>
          <DialogDescription>
            Merge selected holding tokens into one order and recognize revenue.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
