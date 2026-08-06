"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { Product } from "@/src/lib/api/product";
import { formatCostPrice } from "@/src/lib/format";
import { ProductTypeahead } from "@/components/products/product-typeahead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientId } from "@/lib/utils";

export type CampaignPoolRow = {
  key: string;
  productId: string;
  loadedQuantity: string;
  error?: string;
};

export function newCampaignPoolRow(
  seed?: Partial<Pick<CampaignPoolRow, "productId" | "loadedQuantity">>
): CampaignPoolRow {
  return {
    key: createClientId(),
    productId: seed?.productId ?? "",
    loadedQuantity: seed?.loadedQuantity ?? "1",
  };
}

export function poolRowsFromItems(
  items: { productId: string; loadedQuantity: number }[]
): CampaignPoolRow[] {
  if (items.length === 0) return [newCampaignPoolRow()];
  return items.map((item) =>
    newCampaignPoolRow({
      productId: item.productId,
      loadedQuantity: String(item.loadedQuantity),
    })
  );
}

type Props = {
  products: Product[];
  rows: CampaignPoolRow[];
  onChange: (rows: CampaignPoolRow[]) => void;
  totalBags?: string;
  disabled?: boolean;
  /** When false, allow removing the last row (e.g. optional wishlist). Default true. */
  requireAtLeastOne?: boolean;
  title?: string | null;
  quantityLabel?: string;
  productSearchPlaceholder?: string;
  /**
   * `cards` — stacked fields for create/edit dialogs.
   * `list` — campaign participant-style white cards with editable quantity (suggest result).
   * `wishlist` — product picker only, no quantity (suggest wishlist).
   */
  variant?: "cards" | "list" | "wishlist";
};

export function CampaignPoolEditor({
  products,
  rows,
  onChange,
  totalBags,
  disabled = false,
  requireAtLeastOne = true,
  title,
  quantityLabel,
  productSearchPlaceholder,
  variant = "cards",
}: Props) {
  const t = useTranslations("campaigns.create");
  const tCommon = useTranslations("common");
  const tStockIn = useTranslations("products.stockIn");

  const poolSum = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const qty = Number(row.loadedQuantity);
        return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
      }, 0),
    [rows]
  );

  const totalBagsNum = Number(totalBags);
  const poolOverLimit =
    totalBags !== undefined &&
    totalBags !== "" &&
    Number.isInteger(totalBagsNum) &&
    totalBagsNum > 0 &&
    poolSum > totalBagsNum;
  const poolComplete =
    totalBags !== undefined &&
    totalBags !== "" &&
    Number.isInteger(totalBagsNum) &&
    totalBagsNum > 0 &&
    poolSum === totalBagsNum;

  const updateRow = (key: string, patch: Partial<CampaignPoolRow>) => {
    onChange(
      rows.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const canRemove = !requireAtLeastOne || rows.length > 1;
  const showTitle = title !== null;
  const resolvedTitle = title === undefined ? t("productPool") : title;
  const qtyLabel = quantityLabel ?? t("loadedQuantity");
  const searchPlaceholder =
    productSearchPlaceholder ?? t("productSearchPlaceholder");

  const header = showTitle || totalBags !== undefined ? (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        {showTitle && resolvedTitle ? (
          <Label className="text-sm font-medium">{resolvedTitle}</Label>
        ) : null}
        {totalBags !== undefined ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span
              className={
                poolOverLimit
                  ? "font-medium text-destructive"
                  : poolComplete
                    ? "font-medium text-foreground"
                    : "font-medium text-muted-foreground"
              }
            >
              {poolSum}
            </span>
            {totalBags ? ` / ${totalBags}` : ""}
          </p>
        ) : null}
      </div>
    </div>
  ) : null;

  const addButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7"
      disabled={disabled}
      onClick={() => onChange([...rows, newCampaignPoolRow()])}
    >
      <PlusIcon />
      {tCommon("actions.addProduct")}
    </Button>
  );

  if (variant === "wishlist") {
    return (
      <div className="space-y-3">
        {header}

        {rows.length === 0 ? (
          <div className="rounded-lg bg-card px-3 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            {t("emptyWishlistHint")}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const selected = products.find((p) => p.id === row.productId);
              return (
                <li
                  key={row.key}
                  className="min-w-0 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10"
                >
                  <div className="space-y-1.5 px-3 py-2">
                    <ProductTypeahead
                      id={`campaign-pool-product-${row.key}`}
                      products={products}
                      productId={row.productId}
                      showStock
                      showAverageCost
                      disabled={disabled}
                      placeholder={searchPlaceholder}
                      aria-invalid={!!row.error}
                      onSelect={(product) =>
                        updateRow(row.key, {
                          productId: product?.id ?? "",
                        })
                      }
                    />
                    <p className="text-xs leading-snug text-muted-foreground/80">
                      {selected
                        ? `${tStockIn("stock")} ${selected.stockQuantity} · ${tStockIn("avgCost")} ${formatCostPrice(selected.averageCostPrice, tCommon("format.notSet"))}`
                        : t("selectProduct")}
                    </p>
                    {row.error ? (
                      <p className="text-xs text-destructive">{row.error}</p>
                    ) : null}
                  </div>

                  {canRemove ? (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-3 py-1.5">
                      <span className="flex-1" />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={disabled}
                        onClick={() =>
                          onChange(rows.filter((r) => r.key !== row.key))
                        }
                      >
                        <Trash2Icon className="size-3.5" />
                        {tCommon("actions.removeRow")}
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {addButton}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="space-y-3">
        {header}

        {rows.length === 0 ? (
          <div className="rounded-lg bg-card px-3 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            {t("emptyPoolHint")}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => {
              const selected = products.find((p) => p.id === row.productId);
              return (
                <li
                  key={row.key}
                  className="min-w-0 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10"
                >
                  <div className="space-y-1.5 px-3 py-2">
                    <ProductTypeahead
                      id={`campaign-pool-product-${row.key}`}
                      products={products}
                      productId={row.productId}
                      showStock
                      showAverageCost
                      disabled={disabled}
                      placeholder={searchPlaceholder}
                      aria-invalid={!!row.error}
                      onSelect={(product) =>
                        updateRow(row.key, {
                          productId: product?.id ?? "",
                        })
                      }
                    />
                    <p className="text-xs leading-snug text-muted-foreground/80">
                      {selected
                        ? `${tStockIn("stock")} ${selected.stockQuantity} · ${tStockIn("avgCost")} ${formatCostPrice(selected.averageCostPrice, tCommon("format.notSet"))}`
                        : t("selectProduct")}
                    </p>
                    {row.error ? (
                      <p className="text-xs text-destructive">{row.error}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-border/40 px-3 py-1.5">
                    <Label
                      htmlFor={`campaign-pool-qty-${row.key}`}
                      className="text-xs text-muted-foreground"
                    >
                      {qtyLabel}
                    </Label>
                    <Input
                      id={`campaign-pool-qty-${row.key}`}
                      type="number"
                      min={1}
                      inputMode="numeric"
                      className="h-7 w-20"
                      value={row.loadedQuantity}
                      disabled={disabled}
                      onChange={(e) =>
                        updateRow(row.key, {
                          loadedQuantity: e.target.value,
                        })
                      }
                      aria-invalid={!!row.error}
                    />
                    <span className="flex-1" />
                    {canRemove ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={disabled}
                        onClick={() =>
                          onChange(rows.filter((r) => r.key !== row.key))
                        }
                      >
                        <Trash2Icon className="size-3.5" />
                        {tCommon("actions.removeRow")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {addButton}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {header}

      {rows.map((row, index) => {
        const selected = products.find((p) => p.id === row.productId);
        return (
          <div
            key={row.key}
            className="grid gap-3 rounded-xl border border-border/80 bg-card p-3 ring-1 ring-foreground/10"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {tCommon("fields.product")} {index + 1}
              </p>
              {canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled}
                  onClick={() =>
                    onChange(rows.filter((r) => r.key !== row.key))
                  }
                  aria-label={tCommon("actions.removeRow")}
                >
                  <Trash2Icon />
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`campaign-pool-product-${row.key}`}>
                {tCommon("fields.product")}
              </Label>
              <ProductTypeahead
                id={`campaign-pool-product-${row.key}`}
                products={products}
                productId={row.productId}
                showStock
                showAverageCost
                disabled={disabled}
                placeholder={searchPlaceholder}
                aria-invalid={!!row.error}
                onSelect={(product) =>
                  updateRow(row.key, {
                    productId: product?.id ?? "",
                  })
                }
              />
              {selected ? (
                <p className="text-xs text-muted-foreground">
                  {tStockIn("stock")} {selected.stockQuantity}
                  {" · "}
                  {tStockIn("avgCost")}{" "}
                  {formatCostPrice(
                    selected.averageCostPrice,
                    tCommon("format.notSet")
                  )}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>{qtyLabel}</Label>
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={row.loadedQuantity}
                disabled={disabled}
                onChange={(e) =>
                  updateRow(row.key, { loadedQuantity: e.target.value })
                }
                aria-invalid={!!row.error}
              />
            </div>

            {row.error ? (
              <p className="text-xs text-destructive">{row.error}</p>
            ) : null}
          </div>
        );
      })}

      {addButton}
    </div>
  );
}
