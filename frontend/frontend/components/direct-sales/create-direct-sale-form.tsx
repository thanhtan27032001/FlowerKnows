"use client";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  customerApi,
  customerKeys,
  type Customer,
} from "@/src/lib/api/customer";
import {
  directSaleApi,
  directSaleKeys,
  type DirectSale,
} from "@/src/lib/api/direct-sale";
import {
  productApi,
  productKeys,
  type Product,
} from "@/src/lib/api/product";
import { reportKeys } from "@/src/lib/api/report";
import { vnd } from "@/src/lib/format";
import { ProductTypeahead } from "@/components/products/product-typeahead";
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
import { createClientId } from "@/lib/utils";

const SUGGESTION_LIMIT = 20;

type Row = {
  key: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  error?: string;
};

type LineError = {
  lineIndex: number;
  productId?: string;
  message: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function newRow(): Row {
  return {
    key: createClientId(),
    productId: "",
    productName: "",
    quantity: "1",
    unitPrice: "",
  };
}

export function CreateDirectSaleForm({ open, onOpenChange }: Props) {
  const t = useTranslations("directSales.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successSale, setSuccessSale] = useState<DirectSale | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const deferredSearch = useDeferredValue(customerSearch.trim());

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productApi.list(),
    enabled: open,
  });

  const { data: customers = [], isFetching: customersFetching } = useQuery({
    queryKey: customerKeys.search({ q: deferredSearch }),
    queryFn: () => customerApi.search({ q: deferredSearch }),
    enabled: open,
  });

  const suggestions = useMemo(
    () => customers.slice(0, SUGGESTION_LIMIT),
    [customers]
  );

  const orderedProducts = useMemo(() => {
    if (recentProductIds.length === 0) return products;
    const rank = new Map(recentProductIds.map((id, index) => [id, index]));
    return [...products].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return 0;
    });
  }, [products, recentProductIds]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  useEffect(() => {
    if (!open) return;
    setRows([newRow()]);
    setRecentProductIds([]);
    setCustomerId(null);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setSuggestionsOpen(false);
    setFormError(null);
    setSuccessSale(null);
  }, [open]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [suggestionsOpen]);

  const mutation = useMutation({
    mutationFn: directSaleApi.create,
    onSuccess: async (sale) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: directSaleKeys.all }),
        queryClient.invalidateQueries({ queryKey: productKeys.all }),
        queryClient.invalidateQueries({ queryKey: reportKeys.all }),
        sale.customerId
          ? queryClient.invalidateQueries({
              queryKey: customerKeys.detail(sale.customerId),
            })
          : Promise.resolve(),
      ]);
      setSuccessSale(sale);
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
            })
          );
          setFormError(null);
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError(t("failed"));
    },
  });

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const selectProduct = (rowKey: string, product: Product | null) => {
    if (!product) {
      updateRow(rowKey, {
        productId: "",
        productName: "",
        unitPrice: "",
      });
      return;
    }
    setRecentProductIds((prev) => [
      product.id,
      ...prev.filter((id) => id !== product.id),
    ]);
    updateRow(rowKey, {
      productId: product.id,
      productName: product.name,
      unitPrice: String(product.listPrice),
    });
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerId(customer.id);
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setSuggestionsOpen(false);
  };

  const clearCustomer = () => {
    setCustomerId(null);
    setSelectedCustomer(null);
    setCustomerSearch("");
  };

  const validateAndSubmit = () => {
    setFormError(null);
    let valid = true;
    const next = rows.map((row) => {
      const qty = Number(row.quantity);
      const price = Number(row.unitPrice);
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
      if (row.unitPrice.trim() === "" || Number.isNaN(price) || price < 0) {
        valid = false;
        return { ...row, error: t("priceInvalid") };
      }
      const product = productById.get(row.productId);
      if (product && qty > product.stockQuantity) {
        valid = false;
        return {
          ...row,
          error: `SP ${product.name} chỉ còn ${product.stockQuantity} trong kho`,
        };
      }
      return { ...row, error: undefined };
    });
    setRows(next);
    if (!valid) return;

    mutation.mutate({
      customerId,
      lines: next.map((row) => ({
        productId: row.productId,
        quantity: Number(row.quantity),
        unitPrice: Number(row.unitPrice),
      })),
    });
  };

  const close = () => {
    setSuccessSale(null);
    onOpenChange(false);
  };

  const formBody = successSale ? (
    <div className="fk-page-fade grid gap-4">
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-950">
        <p className="font-medium">{t("successTitle")}</p>
        <p className="mt-1 tabular-nums">
          {t("successRevenue", {
            revenue: vnd.format(successSale.recognizedRevenue),
          })}
        </p>
        <p className="tabular-nums">
          {t("successMargin", {
            margin: vnd.format(successSale.grossMargin),
          })}
        </p>
        {successSale.missingCostWarning && (
          <p className="mt-2 text-amber-900">{t("missingCostWarning")}</p>
        )}
      </div>
    </div>
  ) : (
    <fieldset disabled={mutation.isPending} className="min-w-0 space-y-4">
      <div ref={searchWrapRef} className="grid gap-2">
        <Label htmlFor="direct-sale-customer">{t("customerOptional")}</Label>
        <div className="relative">
          <Input
            id="direct-sale-customer"
            value={customerSearch}
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestionsOpen}
            aria-controls="direct-sale-customer-suggestions"
            aria-autocomplete="list"
            placeholder={t("customerPlaceholder")}
            onFocus={() => setSuggestionsOpen(true)}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerId(null);
              setSelectedCustomer(null);
              setSuggestionsOpen(true);
            }}
          />
          {(customerId || customerSearch) && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-1/2 right-1.5 -translate-y-1/2"
              onClick={clearCustomer}
              aria-label={t("customerClear")}
            >
              <XIcon />
            </Button>
          )}
        </div>
        {selectedCustomer && (
          <p className="text-xs text-muted-foreground">
            {selectedCustomer.name}
            {selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ""}
          </p>
        )}
        {suggestionsOpen && (
          <ul
            id="direct-sale-customer-suggestions"
            role="listbox"
            className="max-h-48 overflow-y-auto rounded-lg bg-popover py-1 text-sm shadow-md ring-1 ring-foreground/10"
          >
            {customersFetching && suggestions.length === 0 ? (
              <li className="px-2.5 py-2 text-muted-foreground">
                {t("loadingCustomers")}
              </li>
            ) : suggestions.length === 0 ? (
              <li className="px-2.5 py-2 text-muted-foreground">
                {t("noCustomers")}
              </li>
            ) : (
              suggestions.map((customer) => (
                <li key={customer.id} role="option">
                  <button
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left hover:bg-accent"
                    onClick={() => selectCustomer(customer)}
                  >
                    <span className="font-medium">{customer.name}</span>
                    {customer.phone && (
                      <span className="text-xs text-muted-foreground">
                        {customer.phone}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {rows.map((row, index) => {
        const product = row.productId
          ? productById.get(row.productId)
          : undefined;
        return (
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
              <Label htmlFor={`direct-sale-product-${row.key}`}>
                {t("product")}
              </Label>
              <ProductTypeahead
                id={`direct-sale-product-${row.key}`}
                products={orderedProducts}
                productId={row.productId}
                placeholder={t("productPlaceholder")}
                aria-invalid={!!row.error}
                onSelect={(p) => selectProduct(row.key, p)}
              />
              {product && (
                <p className="text-xs text-muted-foreground">
                  {t("stockHint", { stock: product.stockQuantity })}
                  {" · "}
                  {t("listPriceHint", {
                    price: vnd.format(product.listPrice),
                  })}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>{t("quantity")}</Label>
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
              <div className="grid gap-2">
                <Label>{t("unitPrice")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  inputMode="decimal"
                  value={row.unitPrice}
                  onChange={(e) =>
                    updateRow(row.key, { unitPrice: e.target.value })
                  }
                  aria-invalid={!!row.error}
                />
              </div>
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
      >
        <PlusIcon />
        {tCommon("actions.addRow")}
      </Button>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </fieldset>
  );

  const footer = successSale ? (
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
