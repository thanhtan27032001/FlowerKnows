"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
} from "@/src/lib/api/campaign";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";

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
  const t = useTranslations("campaigns.recordItem");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [customerId, setCustomerId] = useState(defaultCustomerId);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
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

  const resetForm = () => {
    setCustomerId(defaultCustomerId);
    setProductId("");
    setQuantity("1");
    setFieldErrors({});
    setFormError(null);
    setBlockedAllRecorded(false);
  };

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof campaignApi.recordItems>[1]) =>
      campaignApi.recordItems(campaign.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        resetForm();
      });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError ? err.message : t("failed");
      setFormError(message);
      if (message.toLowerCase().includes("already recorded all purchased bags")) {
        setBlockedAllRecorded(true);
      }
    },
  });

  const locked = mutation.isPending || succeeded;

  const validateAndSubmit = () => {
    setFormError(null);
    setBlockedAllRecorded(false);
    const errors: Record<string, string> = {};
    const qty = Number(quantity);

    if (!customerId) errors.customerId = t("participantRequired");
    if (!productId) errors.productId = t("productRequired");
    if (!quantity || Number.isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
      errors.quantity = t("quantityInvalid");
    } else if (selectedProduct && qty > selectedProduct.remainingQuantity) {
      errors.quantity = t("quantityInvalid");
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
    blockedAllRecorded || noParticipants || noPoolLeft;

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      {noParticipants ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {t("participantRequired")}
        </p>
      ) : noPoolLeft ? (
        <p className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {t("poolEmpty")}
        </p>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>{t("participant")}</Label>
            <Select
              value={customerId || undefined}
              onValueChange={(value) => {
                setCustomerId(String(value ?? ""));
                setBlockedAllRecorded(false);
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={t("selectParticipant")} />
              </SelectTrigger>
              <SelectContent>
                {campaign.participants.map((p) => (
                  <SelectItem key={p.customerId} value={p.customerId}>
                    {p.customerName}
                    {p.customerPhone ? ` — ${p.customerPhone}` : ""} (
                    {p.totalBagsPurchased})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedParticipant && (
              <p className="text-xs text-muted-foreground">
                {selectedParticipant.totalBagsPurchased}
              </p>
            )}
            {fieldErrors.customerId && (
              <p className="text-xs text-destructive">{fieldErrors.customerId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>{t("product")}</Label>
            <Select
              value={productId || undefined}
              onValueChange={(value) => {
                setProductId(String(value ?? ""));
                setFormError(null);
              }}
            >
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={t("selectProduct")} />
              </SelectTrigger>
              <SelectContent>
                {availableProducts.map((p) => (
                  <SelectItem key={p.productId} value={p.productId}>
                    {p.productName} ({p.remainingQuantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.productId && (
              <p className="text-xs text-destructive">{fieldErrors.productId}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="record-qty">{t("quantity")}</Label>
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
        onClick={() => {
          onOpenChange(false);
          reset();
          resetForm();
        }}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.saving")}
        disabled={submitDisabled}
        onClick={validateAndSubmit}
      >
        {t("submit")}
      </PendingButton>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      resetForm();
    }
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
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
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
