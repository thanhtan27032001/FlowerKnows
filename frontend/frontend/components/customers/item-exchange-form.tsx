"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { customerKeys, type CustomerToken } from "@/src/lib/api/customer";
import { exchangeApi, exchangeErrorMessage } from "@/src/lib/api/exchange";
import { productApi, productKeys } from "@/src/lib/api/product";
import { vnd } from "@/src/lib/format";
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
  return { key: crypto.randomUUID(), productId: "", quantity: "1" };
}

export function ItemExchangeForm({
  open,
  onOpenChange,
  customerId,
  tokens,
  onSuccess,
}: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

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

  const reset = () => {
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
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      onOpenChange(false);
      reset();
      onSuccess?.();
    },
    onError: (err: unknown) => {
      setFormError(exchangeErrorMessage(err, "Item exchange failed"));
    },
  });

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
      errors.additionalPayment = "Additional payment must be a number";
    }

    let rowsValid = true;
    const nextRows = rows.map((row) => {
      const qty = Number(row.quantity);
      if (!row.productId) {
        rowsValid = false;
        return { ...row, error: "Select a product" };
      }
      if (!row.quantity || Number.isNaN(qty) || qty < 1 || !Number.isInteger(qty)) {
        rowsValid = false;
        return { ...row, error: "Quantity must be a whole number ≥ 1" };
      }
      const product = products.find((p) => p.id === row.productId);
      if (product && qty > product.stockQuantity) {
        rowsValid = false;
        return {
          ...row,
          error: `Only ${product.stockQuantity} available in stock`,
        };
      }
      return { ...row, error: undefined };
    });
    setRows(nextRows);

    // Aggregate qty per product for stock check across rows
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
        errors.pool = `Product ${product.name} does not have enough stock (${product.stockQuantity} available, ${qty} requested)`;
        rowsValid = false;
      }
    }

    if (!rowsValid && !errors.pool) {
      errors.pool = "Fix receive product rows before submitting";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !rowsValid) return;

    mutation.mutate({
      customerId,
      tokenIds: tokens.map((t) => t.id),
      receiveProducts: nextRows.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
      })),
      additionalPayment: additionalNum,
    });
  };

  const formBody = (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          Giving up ({tokens.length} token{tokens.length === 1 ? "" : "s"})
        </p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex justify-between gap-3">
              <span className="truncate">{t.productName}</span>
              <span className="shrink-0 tabular-nums">
                {vnd.format(t.tokenValue)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between border-t border-border/60 pt-2 text-sm font-medium">
          <span>Total token value</span>
          <span className="tabular-nums">{vnd.format(tokensTotal)}</span>
        </p>
      </div>

      <div className="space-y-3">
        <Label>Receive products (from stock)</Label>
        {rows.map((row, index) => {
          const selected = products.find((p) => p.id === row.productId);
          return (
            <div
              key={row.key}
              className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Product {index + 1}
                </p>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                    aria-label="Remove row"
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Product</Label>
                <Select
                  value={row.productId || undefined}
                  onValueChange={(value) =>
                    updateRow(row.key, { productId: String(value ?? "") })
                  }
                >
                  <SelectTrigger className="w-full min-w-0">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {inStockProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.stockQuantity} in stock)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Quantity</Label>
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
          Add product
        </Button>
        {fieldErrors.pool && (
          <p className="text-sm text-destructive">{fieldErrors.pool}</p>
        )}
        {inStockProducts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No products with stock available for exchange.
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="additional-payment">
          Additional payment (VND, optional)
        </Label>
        <Input
          id="additional-payment"
          type="number"
          inputMode="numeric"
          value={additionalPayment}
          onChange={(e) => setAdditionalPayment(e.target.value)}
          aria-invalid={!!fieldErrors.additionalPayment}
        />
        <p className="text-xs text-muted-foreground">
          Can be negative, positive, or 0. New token values will total old value
          + this amount.
        </p>
        {fieldErrors.additionalPayment && (
          <p className="text-xs text-destructive">
            {fieldErrors.additionalPayment}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border/80 bg-background p-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Old tokens</span>
          <span className="tabular-nums">{vnd.format(tokensTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-muted-foreground">Additional payment</span>
          <span className="tabular-nums">
            {additionalValid ? vnd.format(additionalNum) : "—"}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-3 border-t border-border/60 pt-2 font-medium">
          <span>New tokens total value</span>
          <span className="tabular-nums">{vnd.format(liveNewTotal)}</span>
        </div>
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
        disabled={mutation.isPending || tokens.length === 0}
        onClick={validateAndSubmit}
      >
        {mutation.isPending ? "Confirming…" : "Confirm Exchange"}
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
            <SheetTitle>Item Exchange</SheetTitle>
            <SheetDescription>
              Exchange selected tokens for products from general stock (N→N
              supported).
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Item Exchange</DialogTitle>
          <DialogDescription>
            Exchange selected tokens for products from general stock (N→N
            supported).
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
