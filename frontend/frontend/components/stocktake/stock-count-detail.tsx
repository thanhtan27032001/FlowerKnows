"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

const PRODUCT_SEARCH_ID = "stocktake-product-search";

const focusCountedInput = (lineId: string) => {
  const input = document.getElementById(countedInputId(lineId)) as HTMLInputElement | null;
  if (!input) return false;
  input.focus({ preventScroll: true });
  input.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
};

type Props = {
  stockCountId: string;
};

export function StockCountDetail({ stockCountId }: Props) {
  const t = useTranslations("stocktake.detail");
  const { isOwner } = useAuth();
  // Below md: card-per-line with autosave; md+: one editable table saved via "Lưu tất cả".
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const [selectedProductId, setSelectedProductId] = useState("");
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [addLineError, setAddLineError] = useState<string | null>(null);
  const [focusLineId, setFocusLineId] = useState<string | null>(null);

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
    return (productsQuery.data ?? [])
      .filter((p) => !usedIds.has(p.id))
      .sort((a, b) => compareFolded(a.name, b.name));
  }, [productsQuery.data, stockCount]);

  // Client-side split only: "not counted" first (what's left to do), then "counted".
  const { notCountedLines, countedLines } = useMemo(() => {
    const lines = stockCount?.lines ?? [];
    return {
      notCountedLines: lines.filter((l) => l.countedQuantity == null),
      countedLines: lines.filter((l) => l.countedQuantity != null),
    };
  }, [stockCount]);

  const addLineMutation = useMutation({
    mutationFn: () => stockCountApi.addLine(stockCountId, { productId: selectedProductId }),
    onSuccess: async (newLine) => {
      setSelectedProductId("");
      setAddLineError(null);
      await queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });
      setFocusLineId(newLine.id);
    },
    onError: (err: unknown) => {
      setAddLineError(err instanceof ApiError ? err.message : t("addLineFailed"));
    },
  });

  // Focus the freshly added line once its row has rendered.
  useEffect(() => {
    if (!focusLineId) return;
    const frame = requestAnimationFrame(() => {
      if (focusCountedInput(focusLineId)) setFocusLineId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusLineId, stockCount]);

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
                      id={PRODUCT_SEARCH_ID}
                      products={availableProducts}
                      productId={selectedProductId}
                      placeholder={t("productPlaceholder")}
                      showStock
                      onSelect={(product) => setSelectedProductId(product?.id ?? "")}
                    />
                  </div>
                  <Button
                    type="button"
                    disabled={!selectedProductId || addLineMutation.isPending}
                    onClick={() => addLineMutation.mutate()}
                  >
                    <PlusIcon />
                    {t("addButton")}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-fit"
                  onClick={() => setCreateProductOpen(true)}
                >
                  {t("createProductButton")}
                </Button>
                {addLineError && <p className="text-sm text-destructive">{addLineError}</p>}
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
