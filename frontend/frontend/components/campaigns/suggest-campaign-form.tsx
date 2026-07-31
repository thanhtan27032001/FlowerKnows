"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { vnd, vndCost } from "@/src/lib/format";
import { cn } from "@/lib/utils";

type WishlistRow = CampaignPoolRow;

export function SuggestCampaignForm() {
  const t = useTranslations("campaigns.suggest");
  const tCreate = useTranslations("campaigns.create");

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
    queryFn: () => productApi.list(),
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
          [...data.suggestedPool]
            .sort((a, b) => {
              const costA = Number(a.unitCost) || 0;
              const costB = Number(b.unitCost) || 0;
              return costB - costA;
            })
            .map((row) => ({
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
      if (!row.productId) {
        wishlistValid = false;
        return { ...row, error: tCreate("selectProduct") };
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
      if (bags > 0 && ids.length > bags) {
        errors.wishlist = t("wishlistExceedsTotal", {
          count: ids.length,
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
      wishlist: nextWishlist.map((row) => row.productId),
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

  const liveCost = editedCost ?? result?.totalSuggestedCost ?? 0;
  const liveDeviation =
    result != null ? liveCost - resultExpectedCost : 0;
  const liveWithinTolerance =
    result != null ? Math.abs(liveDeviation) <= resultTolerance : false;
  const fillComplete = poolSum === resultTotalBags;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          submitSuggest();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            id="suggest-total-bags"
            label={tCreate("totalBags")}
            error={fieldErrors.totalBags}
          >
            <Input
              id="suggest-total-bags"
              type="number"
              min={1}
              inputMode="numeric"
              value={totalBags}
              onChange={(e) => setTotalBags(e.target.value)}
              aria-invalid={!!fieldErrors.totalBags}
            />
          </Field>

          <Field
            id="suggest-bag-price"
            label={tCreate("bagPrice")}
            error={fieldErrors.bagPrice}
          >
            <Input
              id="suggest-bag-price"
              type="number"
              min={1}
              inputMode="numeric"
              value={bagPrice}
              onChange={(e) => setBagPrice(e.target.value)}
              aria-invalid={!!fieldErrors.bagPrice}
            />
          </Field>

          <Field
            id="suggest-expected-cost"
            label={t("expectedTotalCost")}
            error={fieldErrors.expectedTotalCost}
          >
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
          </Field>

          <Field
            id="suggest-tolerance"
            label={t("costTolerance")}
            error={fieldErrors.costTolerance}
          >
            <Input
              id="suggest-tolerance"
              type="number"
              min={0}
              inputMode="numeric"
              value={costTolerance}
              onChange={(e) => setCostTolerance(e.target.value)}
              aria-invalid={!!fieldErrors.costTolerance}
            />
          </Field>
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
            disabled={suggestMutation.isPending}
            variant="wishlist"
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              {t("resultTitle")}
            </h2>
            <Badge
              variant={liveWithinTolerance ? "secondary" : "outline"}
              className={cn(
                liveWithinTolerance
                  ? "border-transparent bg-emerald-500/15 text-emerald-900"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-950"
              )}
            >
              {liveWithinTolerance
                ? t("withinTolerance")
                : t("outsideToleranceShort")}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label={t("metricBudget")}
              value={vndCost.format(resultExpectedCost)}
              hint={t("metricTolerance", {
                amount: vnd.format(resultTolerance),
              })}
            />
            <Metric
              label={t("metricSuggestedCost")}
              value={vndCost.format(liveCost)}
              hint={t("deviation", {
                amount: formatSignedVnd(liveDeviation),
              })}
              emphasize={!liveWithinTolerance}
            />
            <Metric
              label={t("metricFill")}
              value={`${poolSum} / ${resultTotalBags}`}
              hint={
                fillComplete ? t("fillComplete") : t("fillIncomplete")
              }
              emphasize={!fillComplete}
            />
          </div>

          {result.warnings.length > 0 ? (
            <ul className="space-y-2">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex gap-2.5 rounded-lg border border-amber-500/35 bg-card px-3 py-2.5 text-sm"
                >
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0 text-amber-700"
                    aria-hidden
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2Icon
                className="size-4 shrink-0 text-emerald-700"
                aria-hidden
              />
              {t("noWarnings")}
            </p>
          )}

          <CampaignPoolEditor
            products={products}
            rows={poolRows}
            onChange={setPoolRows}
            totalBags={String(resultTotalBags)}
            variant="list"
          />

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
            <p className="text-xs text-muted-foreground">
              {t("createHint")}
            </p>
            <Button type="button" onClick={openCreateFromSuggestion}>
              {t("createFromSuggestion")}
            </Button>
          </div>
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

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-lg font-semibold tabular-nums tracking-tight",
          emphasize && "text-amber-900"
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function formatSignedVnd(value: number): string {
  const formatted = vnd.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
