"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { customerKeys, type CustomerToken } from "@/src/lib/api/customer";
import { campaignKeys } from "@/src/lib/api/campaign";
import { exchangeApi, exchangeErrorMessage, exchangeKeys } from "@/src/lib/api/exchange";
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

type ReceiveRow = {
  key: string;
  productId: string;
  quantity: string;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  tokens: CustomerToken[];
  onSuccess?: () => void;
};

function newRow(): ReceiveRow {
  return { key: createClientId(), productId: "", quantity: "1" };
}

function isConflictMessage(message: string) {
  return /^(Conflict:|Xung đột:)/.test(message);
}

export function ItemExchangeForm({
  open,
  onOpenChange,
  customerId,
  tokens,
  onSuccess,
}: Props) {
  const t = useTranslations("exchange.item");
  const tErrors = useTranslations("exchange.errors");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [rows, setRows] = useState<ReceiveRow[]>([newRow()]);
  const [additionalPayment, setAdditionalPayment] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
    enabled: open,
  });

  const inStockProducts = useMemo(
    () => products.filter((p) => p.stockQuantity > 0),
    [products]
  );

  const tokensTotal = useMemo(
    () => tokens.reduce((sum, t) => sum + t.tokenValue, 0),
    [tokens]
  );

  const additionalNum = Number(additionalPayment);
  const additionalValid =
    additionalPayment !== "" && !Number.isNaN(additionalNum);
  const liveNewTotal = additionalValid
    ? tokensTotal + additionalNum
    : tokensTotal;

  const resetForm = () => {
    setRows([newRow()]);
    setAdditionalPayment("0");
    setFormError(null);
    setFieldErrors({});
  };

  const mutation = useMutation({
    mutationFn: exchangeApi.itemExchange,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      await queryClient.invalidateQueries({
        queryKey: exchangeKeys.byCustomer(customerId),
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
      setFormError(exchangeErrorMessage(err, t("failed"), tErrors));
    },
  });

  const locked = mutation.isPending || succeeded;

  const updateRow = (key: string, patch: Partial<ReceiveRow>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const validateAndSubmit = () => {
    setFormError(null);
    const errors: Record<string, string> = {};

    if (!additionalValid) {
      errors.additionalPayment = t("additionalInvalid");
    }

    let rowsValid = true;
    const nextRows = rows.map((row) => {
      const qty = Number(row.quantity);
      if (!row.productId) {
        rowsValid = false;
        return { ...row, error: t("selectProduct") };
      }
      if (!row.quantity || Number.isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
        rowsValid = false;
        return { ...row, error: t("quantityInvalid") };
      }
      const product = products.find((p) => p.id === row.productId);
      if (product && qty > product.stockQuantity) {
        rowsValid = false;
        return {
          ...row,
          error: t("quantityInvalid"),
        };
      }
      return { ...row, error: undefined };
    });
    setRows(nextRows);

    const qtyByProduct = new Map<string, number>();
    for (const row of nextRows) {
      if (!row.productId || row.error) continue;
      qtyByProduct.set(
        row.productId,
        (qtyByProduct.get(row.productId) ?? 0) + Number(row.quantity)
      );
    }
    for (const [productId, qty] of qtyByProduct) {
      const product = products.find((p) => p.id === productId);
      if (product && qty > product.stockQuantity) {
        errors.pool = t("fixRows");
        rowsValid = false;
      }
    }

    if (!rowsValid && !errors.pool) {
      errors.pool = t("fixRows");
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !rowsValid) return;

    mutation.mutate({
      customerId,
      tokenIds: tokens.map((tok) => tok.id),
      receiveProducts: nextRows.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      })),
      additionalPayment: additionalNum,
    });
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {t("oldTokens")} ({tokens.length})
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {tokens.map((tok) => (
            <li key={tok.id} className="flex justify-between gap-3">
              <span className="truncate">{tok.productName}</span>
              <span className="shrink-0 tabular-nums">
                {vnd.format(tok.tokenValue)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-border/60 pt-2 text-sm font-medium">
          <span>{t("totalTokenValue")}</span>
          <span className="tabular-nums">{vnd.format(tokensTotal)}</span>
        </p>
      </div>

      <div className="space-y-3">
        <Label>{t("receiveProducts")}</Label>
        {rows.map((row, index) => {
          const selected = products.find((p) => p.id === row.productId);
          return (
            <div
              key={row.key}
              className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("product")} {index + 1}
                </p>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
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
                    <SelectValue placeholder={t("selectProduct")}>{selected ? `${selected.name} (${selected.stockQuantity})` : ""}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {inStockProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.stockQuantity})
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
                  max={selected?.stockQuantity}
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(row.key, { quantity: e.target.value })
                  }
                  aria-invalid={!!row.error}
                />
              </div>

              {row.error && (
                <p className="text-xs text-destructive">{row.error}</p>
              )}
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={() => setRows((prev) => [...prev, newRow()])}
          disabled={inStockProducts.length === 0}
        >
          <PlusIcon />
          {t("addProduct")}
        </Button>
        {fieldErrors.pool && (
          <p className="text-sm text-destructive">{fieldErrors.pool}</p>
        )}
        {inStockProducts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noStock")}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="additional-payment">{t("additionalPayment")}</Label>
        <Input
          id="additional-payment"
          type="number"
          inputMode="numeric"
          value={additionalPayment}
          onChange={(e) => setAdditionalPayment(e.target.value)}
          aria-invalid={!!fieldErrors.additionalPayment}
        />
        {fieldErrors.additionalPayment && (
          <p className="text-xs text-destructive">
            {fieldErrors.additionalPayment}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-background p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">{t("oldTokens")}</span>
          <span className="tabular-nums">{vnd.format(tokensTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-muted-foreground">
            {t("additionalPaymentLabel")}
          </span>
          <span className="tabular-nums">
            {additionalValid
              ? vnd.format(additionalNum)
              : tCommon("fallback.emDash")}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-3 border-t border-border/60 pt-2 font-medium">
          <span>{t("newTokensTotal")}</span>
          <span className="tabular-nums">{vnd.format(liveNewTotal)}</span>
        </div>
      </div>

      {formError && (
        <p
          className={
            isConflictMessage(formError)
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
        pendingLabel={tCommon("pending.confirming")}
        disabled={tokens.length === 0}
        onClick={validateAndSubmit}
      >
        {t("confirm")}
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
      <DialogContent className="sm:max-w-lg">
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
