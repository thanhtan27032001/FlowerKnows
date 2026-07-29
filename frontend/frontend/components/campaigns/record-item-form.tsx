"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
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
import { createClientId } from "@/lib/utils";

type Row = {
  key: string;
  productId: string;
  quantity: string;
  error?: string;
};

function newRow(): Row {
  return { key: createClientId(), productId: "", quantity: "1" };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  defaultCustomerId?: string;
};

type LineError = { lineIndex: number; productId: string; message: string };

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
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [blockedAllRecorded, setBlockedAllRecorded] = useState(false);

  const availableProducts = useMemo(
    () => campaign.pool.filter((p) => p.remainingQuantity > 0),
    [campaign.pool],
  );

  const confirmedParticipants = useMemo(
    () =>
      campaign.participants.filter(
        (p) => (p.status ?? "CONFIRMED") === "CONFIRMED",
      ),
    [campaign.participants],
  );

  const selectedParticipant = useMemo(
    () =>
      confirmedParticipants.find((p) => p.customerId === customerId) ?? null,
    [confirmedParticipants, customerId],
  );

  const resetForm = () => {
    setCustomerId(defaultCustomerId);
    setRows([newRow()]);
    setFieldErrors({});
    setFormError(null);
    setBlockedAllRecorded(false);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row,
      ),
    );
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
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null;
        const lineErrors =
          body && Array.isArray(body.lineErrors)
            ? (body.lineErrors as LineError[])
            : null;

        if (lineErrors && lineErrors.length > 0) {
          setRows((prev) =>
            prev.map((row, i) => {
              const fault = lineErrors.find((le) => le.lineIndex === i);
              return fault ? { ...row, error: fault.message } : row;
            }),
          );
          setFormError(null);
          return;
        }

        setFormError(err.message);
        if (
          err.message
            .toLowerCase()
            .includes("already recorded all purchased bags") ||
          err.message.toLowerCase().includes("exceeding")
        ) {
          setBlockedAllRecorded(true);
        }
      } else {
        setFormError(t("failed"));
      }
    },
  });

  const locked = mutation.isPending || succeeded;

  const validateAndSubmit = () => {
    setFormError(null);
    setBlockedAllRecorded(false);
    const errors: Record<string, string> = {};

    if (!customerId) errors.customerId = t("participantRequired");
    setFieldErrors(errors);

    let rowsValid = true;
    const nextRows = rows.map((row) => {
      const qty = Number(row.quantity);
      if (!row.productId) {
        rowsValid = false;
        return { ...row, error: t("productRequired") };
      }
      if (
        !row.quantity ||
        Number.isNaN(qty) ||
        qty < 1 ||
        !Number.isInteger(qty)
      ) {
        rowsValid = false;
        return { ...row, error: t("quantityInvalid") };
      }
      const pool = availableProducts.find((p) => p.productId === row.productId);
      if (pool && qty > pool.remainingQuantity) {
        rowsValid = false;
        return { ...row, error: t("quantityInvalid") };
      }
      return { ...row, error: undefined };
    });
    setRows(nextRows);

    if (Object.keys(errors).length > 0 || !rowsValid) return;

    mutation.mutate({
      customerId,
      lines: nextRows.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      })),
    });
  };

  const noParticipants = confirmedParticipants.length === 0;
  const noPoolLeft = availableProducts.length === 0;
  const submitDisabled =
    blockedAllRecorded || noParticipants || noPoolLeft;

  const selectedParticipantLabel = selectedParticipant
    ? `${selectedParticipant.customerName}${selectedParticipant.customerPhone ? ` — ${selectedParticipant.customerPhone}` : ""} (${selectedParticipant.totalBagsPurchased})`
    : "";

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
          {/* Participant selector */}
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
                <SelectValue placeholder={t("selectParticipant")}>
                  {selectedParticipantLabel}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {confirmedParticipants.map((p) => (
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
              <p className="text-xs text-destructive">
                {fieldErrors.customerId}
              </p>
            )}
          </div>

          {/* Multi-row product lines */}
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {index + 1}
                </p>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setRows((prev) =>
                        prev.filter((r) => r.key !== row.key),
                      )
                    }
                    aria-label={tCommon("actions.removeRow")}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>

              <div className="grid gap-2">
                <Label>{t("product")}</Label>
                <Select
                  value={row.productId || undefined}
                  onValueChange={(value) =>
                    updateRow(row.key, { productId: String(value ?? "") })
                  }
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder={t("selectProduct")}>
                      {row.productId
                        ? (() => {
                            const p = availableProducts.find(
                              (ap) => ap.productId === row.productId,
                            );
                            return p
                              ? `${p.productName} (${p.remainingQuantity})`
                              : "";
                          })()
                        : ""}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((p) => (
                      <SelectItem key={p.productId} value={p.productId}>
                        {p.productName} ({p.remainingQuantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>{t("quantity")}</Label>
                <Input
                  type="number"
                  min={1}
                  max={
                    availableProducts.find(
                      (p) => p.productId === row.productId,
                    )?.remainingQuantity
                  }
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(row.key, { quantity: e.target.value })
                  }
                  disabled={blockedAllRecorded}
                  aria-invalid={!!row.error}
                />
              </div>

              {row.error && (
                <p className="text-xs text-destructive">{row.error}</p>
              )}
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setRows((prev) => [...prev, newRow()])}
          >
            <PlusIcon />
            {tCommon("actions.addRow")}
          </Button>
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
        <SheetContent side="bottom" className="overflow-y-auto">
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
