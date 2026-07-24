"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
} from "@/src/lib/api/campaign";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-is-mobile";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  defaultCustomerId?: string;
};

export function RecordItemForm({
  open,
  onOpenChange,
  campaign,
  defaultCustomerId = "",
}: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [blockedAllRecorded, setBlockedAllRecorded] = useState(false);

  const availableProducts = useMemo(
    () => campaign.pool.filter((p) => p.remainingQuantity > 0),
    [campaign.pool]
  );

  const selectedParticipant = useMemo(
    () =>
      campaign.participants.find((p) => p.customerId === customerId) ?? null,
    [campaign.participants, customerId]
  );

  const selectedProduct = useMemo(
    () => availableProducts.find((p) => p.productId === productId) ?? null,
    [availableProducts, productId]
  );

  const reset = () => {
    setCustomerId(defaultCustomerId);
    setProductId("");
    setQuantity("");
    setFieldErrors({});
    setFormError(null);
    setBlockedAllRecorded(false);
  };

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof campaignApi.recordItems>[1]) =>
      campaignApi.recordItems(campaign.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      onOpenChange(false);
      reset();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : "Failed to record item";
      setFormError(message);
      if (message.toLowerCase().includes("already recorded all purchased bags")) {
        setBlockedAllRecorded(true);
      }
    },
  });

  const validateAndSubmit = () => {
    setFormError(null);
    setBlockedAllRecorded(false);
    const errors: Record<string, string> = {};
    const qty = Number(quantity);

    if (!customerId) errors.customerId = "Select a participant";
    if (!productId) errors.productId = "Select a product";
    if (!quantity || Number.isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      errors.quantity = "Quantity must be a whole number ≥ 1";
    } else if (selectedProduct && qty > selectedProduct.remainingQuantity) {
      errors.quantity = `Only ${selectedProduct.remainingQuantity} remaining in the pool`;
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    mutation.mutate({
      customerId,
      productId,
      quantity: qty,
    });
  };

  const noParticipants = campaign.participants.length === 0;
  const noPoolLeft = availableProducts.length === 0;
  const submitDisabled =
    mutation.isPending ||
    blockedAllRecorded ||
    noParticipants ||
    noPoolLeft;

  const formBody = (
    <div className="grid gap-4">
      {noParticipants ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Record a participant first before recording opened bags.
        </p>
      ) : noPoolLeft ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          No products remain in the campaign pool.
        </p>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>Participant</Label>
            <Select
              value={customerId || undefined}
              onValueChange={(value) => {
                setCustomerId(String(value ?? ""));
                setBlockedAllRecorded(false);
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Select participant" />
              </SelectTrigger>
              <SelectContent>
                {campaign.participants.map((p) => (
                  <SelectItem key={p.customerId} value={p.customerId}>
                    {p.customerName}
                    {p.customerPhone ? ` — ${p.customerPhone}` : ""} (
                    {p.totalBagsPurchased} bags)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedParticipant && (
              <p className="text-xs text-muted-foreground">
                Purchased {selectedParticipant.totalBagsPurchased} bags — each
                recording creates one token per bag opened.
              </p>
            )}
            {fieldErrors.customerId && (
              <p className="text-xs text-destructive">{fieldErrors.customerId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Product</Label>
            <Select
              value={productId || undefined}
              onValueChange={(value) => {
                setProductId(String(value ?? ""));
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Select product from pool" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.productId} value={p.productId}>
                    {p.productName} ({p.remainingQuantity} remaining)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.productId && (
              <p className="text-xs text-destructive">{fieldErrors.productId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="record-qty">Quantity</Label>
            <Input
              id="record-qty"
              type="number"
              min={1}
              max={selectedProduct?.remainingQuantity}
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setBlockedAllRecorded(false);
              }}
              disabled={blockedAllRecorded}
              aria-invalid={!!fieldErrors.quantity}
            />
            {fieldErrors.quantity && (
              <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
            )}
          </div>
        </>
      )}

      {formError && <p className="text-sm text-destructive">{formError}</p>}
      {blockedAllRecorded && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          This customer has already recorded all purchased bags. Recording is
          blocked.
        </p>
      )}
    </div>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onOpenChange(false);
          reset();
        }}
      >
        Cancel
      </Button>
      <Button
        type="button"
        disabled={submitDisabled}
        onClick={validateAndSubmit}
      >
        {mutation.isPending ? "Saving…" : "Record Item"}
      </Button>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Record Item</SheetTitle>
            <SheetDescription>
              Record which product a customer received when opening bags.
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
          <DialogTitle>Record Item</DialogTitle>
          <DialogDescription>
            Record which product a customer received when opening bags.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
