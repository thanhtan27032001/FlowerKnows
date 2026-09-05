"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys } from "@/src/lib/api/product";
import { stockCountApi, stockCountKeys } from "@/src/lib/api/stock-count";
import { useAuth } from "@/components/providers/auth-provider";
import { CreateProductForm } from "@/components/products/create-product-form";
import { ProductTypeahead } from "@/components/products/product-typeahead";
import { StockCountLineRow } from "@/components/stocktake/stock-count-line-row";
import { CancelStockCountDialog } from "@/components/stocktake/cancel-stock-count-dialog";
import { CompleteStockCountDialog } from "@/components/stocktake/complete-stock-count-dialog";
import { formatDateTime } from "@/src/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

type Props = {
  stockCountId: string;
};

export function StockCountDetail({ stockCountId }: Props) {
  const t = useTranslations("stocktake.detail");
  const { isOwner } = useAuth();
  const queryClient = useQueryClient();

  const [selectedProductId, setSelectedProductId] = useState("");
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
    return (productsQuery.data ?? []).filter((p) => !usedIds.has(p.id));
  }, [productsQuery.data, stockCount]);

  const addLineMutation = useMutation({
    mutationFn: () => stockCountApi.addLine(stockCountId, { productId: selectedProductId }),
    onSuccess: async () => {
      setSelectedProductId("");
      setAddLineError(null);
      await queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });
    },
    onError: (err: unknown) => {
      setAddLineError(err instanceof ApiError ? err.message : t("addLineFailed"));
    },
  });

  if (detailQuery.isLoading || !stockCount) {
    return null;
  }

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

      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("addLineTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="grid gap-1.5">
                <ProductTypeahead
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

      <div className="space-y-3">
        {stockCount.lines.length === 0 ? (
          <Card className="border-border/70 bg-muted/20">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        ) : (
          stockCount.lines.map((line) => (
            <StockCountLineRow
              key={line.id}
              stockCountId={stockCountId}
              line={line}
              readOnly={readOnly}
            />
          ))
        )}
      </div>

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
