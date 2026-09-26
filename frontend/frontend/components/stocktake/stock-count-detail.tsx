"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys } from "@/src/lib/api/product";
import { stockCountApi, stockCountKeys } from "@/src/lib/api/stock-count";
import { useAuth } from "@/components/providers/auth-provider";
import { CreateProductForm } from "@/components/products/create-product-form";
import { ProductTypeahead } from "@/components/products/product-typeahead";
import {
  STOCK_COUNT_COMPACT_GRID,
  StockCountLineRow,
  countedInputId,
} from "@/components/stocktake/stock-count-line-row";
import { StockCountTableView } from "@/components/stocktake/stock-count-table";
import { CancelStockCountDialog } from "@/components/stocktake/cancel-stock-count-dialog";
import { CompleteStockCountDialog } from "@/components/stocktake/complete-stock-count-dialog";
import { formatDateTime } from "@/src/lib/format";
import { compareFolded } from "@/src/lib/text-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

const PRODUCT_SEARCH_ID = "stocktake-product-search";
const NOT_COUNTED_SECTION_ID = "stocktake-not-counted";

const focusCountedInput = (lineId: string) => {
  const input = document.getElementById(countedInputId(lineId)) as HTMLInputElement | null;
  if (!input) return false;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
};

type PendingProduct = { id: string; name: string };

type Props = {
  stockCountId: string;
};

export function StockCountDetail({ stockCountId }: Props) {
  const t = useTranslations("stocktake.detail");
  const tTable = useTranslations("stocktake.table");
  const { isOwner } = useAuth();
  // Below md: card-per-line with autosave; md+: one editable table saved via "Lưu tất cả".
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Phone bulk add: picked products are staged as chips, then created in one call.
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  // Remounting the typeahead is the simplest way to clear its query after a pick.
  const [searchResetKey, setSearchResetKey] = useState(0);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [addLineError, setAddLineError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: stockCountKeys.detail(stockCountId),
    queryFn: () => stockCountApi.get(stockCountId),
  });

  const productsQuery = useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productApi.list(),
  });

  const stockCount = detailQuery.data;
  const readOnly = !!stockCount?.completedAt;

  const availableProducts = useMemo(() => {
    if (!stockCount) return productsQuery.data ?? [];
    const usedIds = new Set(stockCount.lines.map((l) => l.productId));
    const pendingIds = new Set(pendingProducts.map((p) => p.id));
    return (productsQuery.data ?? [])
      .filter((p) => !usedIds.has(p.id) && !pendingIds.has(p.id))
      .sort((a, b) => compareFolded(a.name, b.name));
  }, [productsQuery.data, stockCount, pendingProducts]);

  // Client-side split only: "not counted" first (what's left to do), then "counted".
  const { notCountedLines, countedLines } = useMemo(() => {
    const lines = stockCount?.lines ?? [];
    return {
      notCountedLines: lines.filter((l) => l.countedQuantity == null),
      countedLines: lines.filter((l) => l.countedQuantity != null),
    };
  }, [stockCount]);

  const addLinesMutation = useMutation({
    mutationFn: (products: PendingProduct[]) =>
      stockCountApi.addLinesBulk(stockCountId, {
        items: products.map((p) => ({ productId: p.id })),
      }),
    onSuccess: async (result) => {
      setPendingProducts([]);
      setAddLineError(null);
      await queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });
      if (result.skippedProductIds.length > 0) {
        toast.info(tTable("skipped", { count: result.skippedProductIds.length }));
      }
      // New lines land at the top of "Chưa đếm" (newest-first); bring that into view.
      document
        .getElementById(NOT_COUNTED_SECTION_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    onError: (err: unknown) => {
      // Keep the staged chips so a retry doesn't need re-searching.
      const message = t("addLineFailed");
      setAddLineError(err instanceof ApiError ? `${message}: ${err.message}` : message);
      toast.error(message);
    },
  });

  const stageProduct = (product: PendingProduct | null) => {
    if (!product) return;
    setPendingProducts((prev) =>
      prev.some((p) => p.id === product.id)
        ? prev
        : [...prev, { id: product.id, name: product.name }]
    );
    setSearchResetKey((k) => k + 1);
  };

  /** Enter in a counted field: next line in the same section, else the product search. */
  const focusNextCountedInput = useCallback(
    (currentLineId: string) => {
      const section = notCountedLines.some((l) => l.id === currentLineId)
        ? notCountedLines
        : countedLines;
      const index = section.findIndex((l) => l.id === currentLineId);
      const next = section[index + 1];
      if (next && focusCountedInput(next.id)) return;
      const search = document.getElementById(PRODUCT_SEARCH_ID);
      search?.focus({ preventScroll: true });
      search?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [notCountedLines, countedLines]
  );

  if (detailQuery.isLoading || !stockCount) {
    return null;
  }

  const totalLines = stockCount.lines.length;
  const progressLabel = t("progress", { counted: countedLines.length, total: totalLines });

  const sections = [
    { key: "not-counted", label: t("notCountedSection"), lines: notCountedLines },
    { key: "counted", label: t("countedSection"), lines: countedLines },
  ].filter((section) => section.lines.length > 0);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-xl">
              {stockCount.note?.trim() || t("fallbackTitle")}
            </CardTitle>
            <p className="text-sm text-muted-foreground tabular-nums">
              {readOnly
                ? `${t("completedAt")} ${formatDateTime(stockCount.completedAt!)}`
                : `${t("startedAt")} ${formatDateTime(stockCount.createdAt)}`}
            </p>
            {totalLines > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <div
                  className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={totalLines}
                  aria-valuenow={countedLines.length}
                  aria-label={progressLabel}
                >
                  <div
                    className="h-full rounded-full bg-primary transition-[width]"
                    style={{ width: `${(countedLines.length / totalLines) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium tabular-nums">{progressLabel}</span>
              </div>
            )}
          </div>
          <StatusBadge variant={readOnly ? "neutral" : "info"}>
            {readOnly ? t("statusCompleted") : t("statusInProgress")}
          </StatusBadge>
        </CardHeader>
        {!readOnly && (
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(true)}>
              {t("cancelButton")}
            </Button>
            {isOwner && (
              <Button type="button" onClick={() => setCompleteOpen(true)}>
                {t("completeButton")}
              </Button>
            )}
            {!isOwner && (
              <p className="self-center text-xs text-muted-foreground">
                {t("ownerOnlyHint")}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {!isMobile ? (
        <StockCountTableView
          stockCountId={stockCountId}
          lines={stockCount.lines}
          products={productsQuery.data ?? []}
          readOnly={readOnly}
          onCreateProduct={() => setCreateProductOpen(true)}
        />
      ) : (
        <>
          {!readOnly && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("addLineTitle")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-1.5">
                    <ProductTypeahead
                      key={searchResetKey}
                      id={PRODUCT_SEARCH_ID}
                      products={availableProducts}
                      productId=""
                      placeholder={t("productPlaceholder")}
                      showStock
                      // Refocus after each pick so the next product can be typed right away.
                      autoFocus={searchResetKey > 0}
                      disabled={addLinesMutation.isPending}
                      onSelect={stageProduct}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={pendingProducts.length === 0 || addLinesMutation.isPending}
                    onClick={() => addLinesMutation.mutate(pendingProducts)}
                  >
                    <PlusIcon />
                    {t("addNButton", { count: pendingProducts.length })}
                  </Button>
                </div>
                {pendingProducts.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t("pendingProductsLabel")}>
                    {pendingProducts.map((product) => (
                      <li key={product.id} className="max-w-full">
                        <Badge variant="secondary" className="h-7 max-w-full gap-1 pr-0.5 pl-2.5 text-sm">
                          <span className="truncate">{product.name}</span>
                          <button
                            type="button"
                            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-foreground/10 disabled:opacity-50"
                            disabled={addLinesMutation.isPending}
                            onClick={() =>
                              setPendingProducts((prev) => prev.filter((p) => p.id !== product.id))
                            }
                            aria-label={t("removePendingProduct", { product: product.name })}
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => setCreateProductOpen(true)}
                >
                  {t("createProductButton")}
                </Button>
                {addLineError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-destructive bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive"
                  >
                    {addLineError}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {totalLines === 0 ? (
            <Card className="border-border/70 bg-muted/20">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </CardContent>
            </Card>
          ) : (
            // Rows and section headers are flat siblings so a line moving between
            // sections is re-ordered (keeping focus/state), not remounted.
            <div className="grid gap-3">
              {sections.flatMap((section) => [
                <h2
                  key={`${section.key}-heading`}
                  id={section.key === "not-counted" ? NOT_COUNTED_SECTION_ID : undefined}
                  className="pt-1 text-sm font-medium text-muted-foreground"
                >
                  {section.label} ({section.lines.length})
                </h2>,
                <div
              key={`${section.key}-columns`}
              aria-hidden
              className={cn(
                "-mb-1 px-3 text-xs text-muted-foreground",
                STOCK_COUNT_COMPACT_GRID
              )}
            >
              <span>{t("product")}</span>
              <span>{t("countedQuantity")}</span>
            </div>,
            ...section.lines.map((line) => (
                  <StockCountLineRow
                    key={line.id}
                    stockCountId={stockCountId}
                    line={line}
                    readOnly={readOnly}
                    onAdvance={focusNextCountedInput}
                  />
                )),
              ])}
            </div>
          )}
        </>
      )}

      <CreateProductForm open={createProductOpen} onOpenChange={setCreateProductOpen} />

      <CancelStockCountDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        stockCountId={stockCountId}
      />

      {isOwner && (
        <CompleteStockCountDialog
          open={completeOpen}
          onOpenChange={setCompleteOpen}
          stockCount={stockCount}
          products={productsQuery.data ?? []}
        />
      )}
    </div>
  );
}
