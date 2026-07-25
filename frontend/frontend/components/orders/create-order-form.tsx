"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { customerKeys, type CustomerToken } from "@/src/lib/api/customer";
import { orderApi, orderKeys } from "@/src/lib/api/order";
import { productKeys } from "@/src/lib/api/product";
import { reportKeys } from "@/src/lib/api/report";
import { formatCostPrice, formatDateTime, vnd, vndCost } from "@/src/lib/format";
import { exchangeTypeLabel } from "@/src/lib/i18n-labels";
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

export function CreateOrderForm({
  open,
  onOpenChange,
  customerId,
  tokens,
  onSuccess,
}: Props) {
  const t = useTranslations("orders.create");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("common.status");
  const tToken = useTranslations("customers.tokenCard");
  const tActionBar = useTranslations("customers.actionBar");
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [formError, setFormError] = useState<string | null>(null);
  const [carrierOrderId, setCarrierOrderId] = useState("");

  // Display-only preview of figures the backend will persist on create (US-09 AC #1)
  const expectedRevenue = useMemo(
    () => tokens.reduce((sum, token) => sum + token.tokenValue, 0),
    [tokens]
  );
  const expectedTotalCost = useMemo(
    () => tokens.reduce((sum, token) => sum + (token.costBasis ?? 0), 0),
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
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
      await runSuccess(() => {
        setCarrierOrderId("");
        onOpenChange(false);
        onSuccess?.();
        router.push(`/orders?highlight=${order.id}`);
      });
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : t("failed")
      );
    },
  });

  const locked = mutation.isPending || succeeded;

  const submit = () => {
    setFormError(null);
    mutation.mutate({
      customerId,
      tokenIds: tokens.map((token) => token.id),
      carrierOrderId: carrierOrderId.trim() || null,
    });
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      setFormError(null);
      setCarrierOrderId("");
    }
  };

  const sourceDisplay = (token: CustomerToken) =>
    token.sourceType === "EXCHANGE"
      ? exchangeTypeLabel(tStatus, "item_exchange")
      : token.sourceLabel;

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {tActionBar("selected", { count: tokens.length })}
        </p>
        <ul className="mt-2 space-y-2 text-sm">
          {tokens.map((token) => (
            <li key={token.id} className="flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {token.productName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {sourceDisplay(token)} · {formatDateTime(token.createdAt)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {tToken("costBasis")}{" "}
                  {formatCostPrice(token.costBasis, tCommon("format.notSet"))}
                </span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block">{vnd.format(token.tokenValue)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-2 rounded-xl border border-border/80 bg-background p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">{t("expectedRevenue")}</p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vnd.format(expectedRevenue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("expectedTotalCost")}
            </p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vndCost.format(expectedTotalCost)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {t("expectedGrossMargin")}
            </p>
            <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
              {vndCost.format(expectedGrossMargin)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="carrier-order-id">{t("carrierOptional")}</Label>
        <Input
          id="carrier-order-id"
          value={carrierOrderId}
          onChange={(e) => setCarrierOrderId(e.target.value)}
          placeholder={t("carrierPlaceholder")}
        />
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
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.creating")}
        disabled={tokens.length === 0}
        onClick={submit}
      >
        {t("confirm")}
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
