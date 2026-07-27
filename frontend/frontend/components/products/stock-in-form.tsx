"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  productApi,
  productKeys,
  type Product,
} from "@/src/lib/api/product";
import { reportKeys } from "@/src/lib/api/report";
import { formatCostPrice } from "@/src/lib/format";
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
import { createClientId } from "@/lib/utils";

type Row = {
  key: string;
  productId: string;
  quantity: string;
  costPrice: string;
  note: string;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProductId?: string;
  onSuccess?: (products: Product[]) => void;
};

function newRow(productId = ""): Row {
  return {
    key: createClientId(),
    productId,
    quantity: "",
    costPrice: "",
    note: "",
  };
}

export function StockInForm({
  open,
  onOpenChange,
  defaultProductId,
  onSuccess,
}: Props) {
  const t = useTranslations("products.stockIn");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>([newRow(defaultProductId ?? "")]);
  const [formError, setFormError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<Product[] | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setRows([newRow(defaultProductId ?? "")]);
      setFormError(null);
      setSuccessSummary(null);
    }
  }, [open, defaultProductId]);

  const mutation = useMutation({
    mutationFn: productApi.stockIn,
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await queryClient.invalidateQueries({ queryKey: reportKeys.all });
      setSuccessSummary(result.products);
      onSuccess?.(result.products);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const validateAndSubmit = () => {
    setFormError(null);
    setSuccessSummary(null);
    let valid = true;
    const next = rows.map((row) => {
      const qty = Number(row.quantity);
      const cost = Number(row.costPrice);
      if (!row.productId) {
        valid = false;
        return { ...row, error: t("selectProduct") };
      }
      if (
        !row.quantity ||
        Number.isNaN(qty) ||
        qty <= 0 ||
        !Number.isInteger(qty)
      ) {
        valid = false;
        return { ...row, error: t("quantityInvalid") };
      }
      if (
        row.costPrice.trim() === "" ||
        Number.isNaN(cost) ||
        cost <= 0
      ) {
        valid = false;
        return { ...row, error: t("costInvalid") };
      }
      return { ...row, error: undefined };
    });
    setRows(next);
    if (!valid) return;

    mutation.mutate(
      next.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
        costPrice: Number(row.costPrice),
        note: row.note.trim() || undefined,
      }))
    );
  };

  const close = () => {
    setSuccessSummary(null);
    onOpenChange(false);
  };

  const formBody = successSummary ? (
    <div className="fk-page-fade grid gap-4">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-950">
        <p className="font-medium">{t("successTitle")}</p>
        <p className="mt-1 text-muted-foreground">{t("updatedAvg")}</p>
        <ul className="mt-2 space-y-1.5">
          {successSummary.map((product) => (
            <li
              key={product.id}
              className="flex items-start justify-between gap-3"
            >
              <span className="min-w-0 truncate font-medium">{product.name}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-xs text-muted-foreground">
                  {t("stock")} {product.stockQuantity}
                </span>
                <span className="block">
                  {t("avgCost")}{" "}
                  {formatCostPrice(
                    product.averageCostPrice,
                    tCommon("format.notSet")
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  ) : (
    <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
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
                <SelectValue placeholder={tCommon("actions.selectProduct")} />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>{t("costPrice")}</Label>
              <Input
                type="number"
                min={1}
                step="1"
                inputMode="decimal"
                value={row.costPrice}
                onChange={(e) =>
                  updateRow(row.key, { costPrice: e.target.value })
                }
                placeholder={t("noteRequired")}
                aria-invalid={!!row.error}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("quantityReceived")}</Label>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={row.quantity}
                onChange={(e) =>
                  updateRow(row.key, { quantity: e.target.value })
                }
                aria-invalid={!!row.error}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t("note")}</Label>
            <Input
              value={row.note}
              onChange={(e) => updateRow(row.key, { note: e.target.value })}
              placeholder={t("notePlaceholder")}
            />
          </div>

          {row.error && <p className="text-xs text-destructive">{row.error}</p>}
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

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </fieldset>
  );

  const footer = successSummary ? (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button type="button" onClick={close}>
        {tCommon("actions.done")}
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={mutation.isPending}
        onClick={close}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        pendingLabel={tCommon("pending.saving")}
        onClick={validateAndSubmit}
      >
        {t("confirm")}
      </PendingButton>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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
