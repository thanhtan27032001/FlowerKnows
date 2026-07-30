"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import type { Product } from "@/src/lib/api/product";
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
}: Props) {
  const t = useTranslations("campaigns.create");
  const tCommon = useTranslations("common");

  const poolSum = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const qty = Number(row.loadedQuantity);
        return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
      }, 0),
    [rows]
  );

  const totalBagsNum = Number(totalBags);
  const quantitiesMatch =
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

  return (
    <div className="space-y-3">
      {showTitle || totalBags !== undefined ? (
        <div className="flex items-end justify-between gap-2">
          <div>
            {showTitle && resolvedTitle ? (
              <Label>{resolvedTitle}</Label>
            ) : null}
            {totalBags !== undefined ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                <span
                  className={
                    quantitiesMatch
                      ? "font-medium text-foreground"
                      : "font-medium text-destructive"
                  }
                >
                  {poolSum}
                </span>
                {totalBags ? ` / ${totalBags}` : ""}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {rows.map((row, index) => {
        const selected = products.find((p) => p.id === row.productId);
        return (
          <div
            key={row.key}
            className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
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
                disabled={disabled}
                placeholder={
                  productSearchPlaceholder ?? t("productSearchPlaceholder")
                }
                aria-invalid={!!row.error}
                onSelect={(product) =>
                  updateRow(row.key, {
                    productId: product?.id ?? "",
                  })
                }
              />
            </div>

            <div className="grid gap-2">
              <Label>{quantityLabel ?? t("loadedQuantity")}</Label>
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
              {selected ? (
                <p className="text-xs text-muted-foreground">
                  {selected.stockQuantity}
                </p>
              ) : null}
            </div>

            {row.error ? (
              <p className="text-xs text-destructive">{row.error}</p>
            ) : null}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onChange([...rows, newCampaignPoolRow()])}
      >
        <PlusIcon />
        {tCommon("actions.addProduct")}
      </Button>
    </div>
  );
}
