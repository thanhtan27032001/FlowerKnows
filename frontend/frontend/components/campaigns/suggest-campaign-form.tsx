"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  type SuggestPoolInput,
  type SuggestPoolResult,
} from "@/src/lib/api/campaign";
import { productApi, productKeys } from "@/src/lib/api/product";
import {
  CampaignPoolEditor,
  poolRowsFromItems,
  type CampaignPoolRow,
} from "@/components/campaigns/campaign-pool-editor";
import {
  CreateCampaignForm,
  type CreateCampaignPrefill,
} from "@/components/campaigns/create-campaign-form";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vnd, vndCost } from "@/src/lib/format";

type WishlistRow = CampaignPoolRow;

export function SuggestCampaignForm() {
  const t = useTranslations("campaigns.suggest");
  const tCreate = useTranslations("campaigns.create");
  const tCommon = useTranslations("common");

  const [totalBags, setTotalBags] = useState("20");
  const [bagPrice, setBagPrice] = useState("89000");
  const [expectedTotalCost, setExpectedTotalCost] = useState("1200000");
  const [costTolerance, setCostTolerance] = useState("50000");
  const [wishlistRows, setWishlistRows] = useState<WishlistRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [result, setResult] = useState<SuggestPoolResult | null>(null);
  const [resultBagPrice, setResultBagPrice] = useState(0);
  const [resultTotalBags, setResultTotalBags] = useState(0);
  const [resultExpectedCost, setResultExpectedCost] = useState(0);
  const [resultTolerance, setResultTolerance] = useState(0);
  const [poolRows, setPoolRows] = useState<CampaignPoolRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] =
    useState<CreateCampaignPrefill | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
  });

  const suggestMutation = useMutation({
    mutationFn: campaignApi.suggestPool,
    onSuccess: (data, variables) => {
      setResult(data);
      setResultBagPrice(variables.bagPrice);
      setResultTotalBags(variables.totalBags);
      setResultExpectedCost(variables.expectedTotalCost);
      setResultTolerance(variables.costTolerance);
      setPoolRows(
        poolRowsFromItems(
          data.suggestedPool.map((row) => ({
            productId: row.productId,
            loadedQuantity: row.quantity,
          }))
        )
      );
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
      setResult(null);
    },
  });

  const poolSum = useMemo(
    () =>
      poolRows.reduce((sum, row) => {
        const qty = Number(row.loadedQuantity);
        return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
      }, 0),
    [poolRows]
  );

  const editedCost = useMemo(() => {
    if (!result) return null;
    const costByProduct = new Map(
      result.suggestedPool.map((row) => [row.productId, row.unitCost])
    );
    return poolRows.reduce((sum, row) => {
      const qty = Number(row.loadedQuantity);
      if (!row.productId || !Number.isInteger(qty) || qty < 1) return sum;
      const unit =
        costByProduct.get(row.productId) ??
        products.find((p) => p.id === row.productId)?.averageCostPrice ??
        0;
      return sum + unit * qty;
    }, 0);
  }, [poolRows, products, result]);

  const validateInputs = (): SuggestPoolInput | null => {
    const errors: Record<string, string> = {};

    const bags = Number(totalBags);
    if (!totalBags || Number.isNaN(bags) || bags < 1 || !Number.isInteger(bags)) {
      errors.totalBags = tCreate("totalBagsInvalid");
    }

    const price = Number(bagPrice);
    if (!bagPrice || Number.isNaN(price) || price <= 0) {
      errors.bagPrice = tCreate("bagPriceInvalid");
    }

    const expected = Number(expectedTotalCost);
    if (
      expectedTotalCost === "" ||
      Number.isNaN(expected) ||
      expected < 0
    ) {
      errors.expectedTotalCost = t("expectedTotalCostInvalid");
    }

    const tolerance = Number(costTolerance);
    if (
      costTolerance === "" ||
      Number.isNaN(tolerance) ||
      tolerance < 0
    ) {
      errors.costTolerance = t("costToleranceInvalid");
    }

    let wishlistValid = true;
    const nextWishlist = wishlistRows.map((row) => {
      const qty = Number(row.loadedQuantity);
      if (!row.productId) {
        wishlistValid = false;
        return { ...row, error: tCreate("selectProduct") };
      }
      if (
        !row.loadedQuantity ||
        Number.isNaN(qty) ||
        qty < 1 ||
        !Number.isInteger(qty)
      ) {
        wishlistValid = false;
        return { ...row, error: t("wishlistQtyInvalid") };
      }
      return { ...row, error: undefined };
    });
    setWishlistRows(nextWishlist);

    if (!wishlistValid) {
      errors.wishlist = t("fixWishlist");
    } else {
      const ids = nextWishlist.map((r) => r.productId).filter(Boolean);
      if (new Set(ids).size !== ids.length) {
        errors.wishlist = t("duplicateWishlistProduct");
      }
      const wishlistQty = nextWishlist.reduce(
        (sum, row) => sum + Number(row.loadedQuantity),
        0
      );
      if (bags > 0 && wishlistQty > bags) {
        errors.wishlist = t("wishlistExceedsTotal", {
          wishlistQty,
          totalBags: bags,
        });
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !wishlistValid) return null;

    return {
      totalBags: bags,
      bagPrice: price,
      expectedTotalCost: expected,
      costTolerance: tolerance,
      wishlist: nextWishlist.map((row) => ({
        productId: row.productId,
        quantity: Number(row.loadedQuantity),
      })),
    };
  };

  const submitSuggest = () => {
    setFormError(null);
    const payload = validateInputs();
    if (!payload) return;
    suggestMutation.mutate(payload);
  };

  const openCreateFromSuggestion = () => {
    if (!result) return;

    const nextRows = poolRows.map((row) => {
      const qty = Number(row.loadedQuantity);
      if (!row.productId) {
        return { ...row, error: tCreate("selectProduct") };
      }
      if (
        !row.loadedQuantity ||
        Number.isNaN(qty) ||
        qty < 1 ||
        !Number.isInteger(qty)
      ) {
        return { ...row, error: tCreate("loadedQtyInvalid") };
      }
      return { ...row, error: undefined };
    });
    setPoolRows(nextRows);

    if (nextRows.some((row) => row.error)) return;
    const productIds = nextRows.map((r) => r.productId);
    if (new Set(productIds).size !== productIds.length) {
      setFormError(tCreate("duplicateProduct"));
      return;
    }

    setCreatePrefill({
      bagPrice: resultBagPrice,
      totalBags: resultTotalBags,
      pool: nextRows.map((row) => ({
        productId: row.productId,
        loadedQuantity: Number(row.loadedQuantity),
      })),
    });
    setCreateOpen(true);
  };

  const liveDeviation =
    result != null && editedCost !== null
      ? editedCost - resultExpectedCost
      : result?.deviation ?? 0;
  const liveWithinTolerance =
    result != null ? Math.abs(liveDeviation) <= resultTolerance : false;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitSuggest();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="suggest-total-bags">{tCreate("totalBags")}</Label>
            <Input
              id="suggest-total-bags"
              type="number"
              min={1}
              inputMode="numeric"
              value={totalBags}
              onChange={(e) => setTotalBags(e.target.value)}
              aria-invalid={!!fieldErrors.totalBags}
            />
            {fieldErrors.totalBags ? (
              <p className="text-xs text-destructive">{fieldErrors.totalBags}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suggest-bag-price">{tCreate("bagPrice")}</Label>
            <Input
              id="suggest-bag-price"
              type="number"
              min={1}
              inputMode="numeric"
              value={bagPrice}
              onChange={(e) => setBagPrice(e.target.value)}
              aria-invalid={!!fieldErrors.bagPrice}
            />
            {fieldErrors.bagPrice ? (
              <p className="text-xs text-destructive">{fieldErrors.bagPrice}</p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suggest-expected-cost">
              {t("expectedTotalCost")}
            </Label>
            <Input
              id="suggest-expected-cost"
              type="number"
              min={0}
              inputMode="numeric"
              value={expectedTotalCost}
              onChange={(e) => setExpectedTotalCost(e.target.value)}
              placeholder="800000"
              aria-invalid={!!fieldErrors.expectedTotalCost}
            />
            {fieldErrors.expectedTotalCost ? (
              <p className="text-xs text-destructive">
                {fieldErrors.expectedTotalCost}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="suggest-tolerance">{t("costTolerance")}</Label>
            <Input
              id="suggest-tolerance"
              type="number"
              min={0}
              inputMode="numeric"
              value={costTolerance}
              onChange={(e) => setCostTolerance(e.target.value)}
              aria-invalid={!!fieldErrors.costTolerance}
            />
            {fieldErrors.costTolerance ? (
              <p className="text-xs text-destructive">
                {fieldErrors.costTolerance}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <Label>{t("wishlist")}</Label>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("wishlistHint")}
            </p>
          </div>
          <CampaignPoolEditor
            products={products}
            rows={wishlistRows}
            onChange={setWishlistRows}
            requireAtLeastOne={false}
            title={null}
            quantityLabel={tCommon("fields.quantity")}
            disabled={suggestMutation.isPending}
          />
          {fieldErrors.wishlist ? (
            <p className="text-sm text-destructive">{fieldErrors.wishlist}</p>
          ) : null}
        </div>

        {formError && !result ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : null}

        <PendingButton
          type="submit"
          pending={suggestMutation.isPending}
          pendingLabel={t("suggesting")}
        >
          {t("submit")}
        </PendingButton>
      </form>

      {result ? (
        <section className="space-y-4 border-t border-border pt-6">
          <div className="space-y-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              {t("resultTitle")}
            </h2>

            <div
              className={
                liveWithinTolerance
                  ? "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm"
                  : "rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
              }
            >
              <p className="font-medium">
                {t("deviation", {
                  amount: formatSignedVnd(liveDeviation),
                })}
              </p>
              <p className="mt-1 text-muted-foreground">
                {t("totalSuggestedCost", {
                  amount: vndCost.format(editedCost ?? result.totalSuggestedCost),
                })}
                {" · "}
                {liveWithinTolerance
                  ? t("withinTolerance")
                  : t("outsideTolerance")}
              </p>
              {poolSum !== resultTotalBags ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("editedPoolSum", {
                    sum: poolSum,
                    totalBags: resultTotalBags,
                  })}
                </p>
              ) : null}
            </div>

            {result.warnings.length > 0 ? (
              <ul className="space-y-2">
                {result.warnings.map((warning) => (
                  <li
                    key={warning}
                    className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100"
                  >
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <CampaignPoolEditor
            products={products}
            rows={poolRows}
            onChange={setPoolRows}
            totalBags={String(resultTotalBags)}
          />

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <Button type="button" onClick={openCreateFromSuggestion}>
            {t("createFromSuggestion")}
          </Button>
        </section>
      ) : null}

      <CreateCampaignForm
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) setCreatePrefill(null);
        }}
        initialValues={createPrefill}
      />
    </div>
  );
}

function formatSignedVnd(value: number): string {
  const formatted = vnd.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
