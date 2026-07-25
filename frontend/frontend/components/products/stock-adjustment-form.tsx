"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys, type Product } from "@/src/lib/api/product";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  product: Product;
};

export function StockAdjustmentForm({ open, onOpenChange, product }: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [direction, setDirection] = useState<"INCREASE" | "DECREASE">("INCREASE");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDirection("INCREASE");
      setQuantity("");
      setNote("");
      setErrors({});
      setFormError(null);
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: (input: {
      direction: "INCREASE" | "DECREASE";
      quantity: number;
      note: string;
    }) => productApi.adjustStock(product.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
      });
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Adjustment failed");
    },
  });

  const locked = mutation.isPending || succeeded;

  const submit = () => {
    setFormError(null);
    const nextErrors: Record<string, string> = {};
    const qty = Number(quantity);

    if (!quantity || Number.isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      nextErrors.quantity = "Quantity must be a whole number greater than 0";
    }
    if (!note.trim()) {
      nextErrors.note = "Please enter a reason for the adjustment";
    }
    if (
      direction === "DECREASE" &&
      !Number.isNaN(qty) &&
      qty > product.stockQuantity
    ) {
      nextErrors.quantity = `Cannot decrease below current stock (${product.stockQuantity} available)`;
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    mutation.mutate({
      direction,
      quantity: qty,
      note: note.trim(),
    });
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border/80 bg-muted/30 px-3 py-2 text-sm">
        Current stock:{" "}
        <span className="font-semibold tabular-nums">{product.stockQuantity}</span>
      </div>

      <div className="grid gap-2">
        <Label>Adjustment type</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={direction === "INCREASE" ? "default" : "outline"}
            onClick={() => setDirection("INCREASE")}
          >
            Increase
          </Button>
          <Button
            type="button"
            variant={direction === "DECREASE" ? "default" : "outline"}
            onClick={() => setDirection("DECREASE")}
          >
            Decrease
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="adjust-qty">Quantity</Label>
        <Input
          id="adjust-qty"
          type="number"
          min={1}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={!!errors.quantity}
        />
        {errors.quantity && (
          <p className="text-xs text-destructive">{errors.quantity}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="adjust-note">Reason</Label>
        <Textarea
          id="adjust-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Damaged during count, Lost item, Count surplus"
          aria-invalid={!!errors.note}
        />
        {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
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
        pendingLabel="Saving…"
        onClick={submit}
      >
        Confirm Adjustment
      </PendingButton>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Adjust Stock</SheetTitle>
            <SheetDescription>
              Manually correct stock for {product.name}.
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Manually correct stock for {product.name}.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
