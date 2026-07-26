"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { MovementHistory } from "@/components/products/movement-history";
import { StockAdjustmentForm } from "@/components/products/stock-adjustment-form";
import { StockInForm } from "@/components/products/stock-in-form";
import { useAuth } from "@/components/providers/auth-provider";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, vnd } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function ProductDetailSkeleton() {
  const tCommon = useTranslations("common.a11y");

  return (
    <div className="space-y-5" aria-busy="true" aria-label={tCommon("loading")}>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("products");
  const tDetail = useTranslations("products.detail");
  const tCommon = useTranslations("common");
  const { isOwner } = useAuth();
  const [stockInOpen, setStockInOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [stockInNotice, setStockInNotice] = useState<string | null>(null);

  const {
    data: product,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productApi.get(id),
  });

  return (
    <AppShell
      title={product?.name ?? t("detailFallbackTitle")}
      actions={
        <Link
          href="/products"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {tCommon("actions.back")}
        </Link>
      }
    >
      <div className="relative">
        <QueryProgressBar active={isFetching && !isLoading} />

        {isLoading && <ProductDetailSkeleton />}

        {isError && (
          <QueryErrorState
            message={
              error instanceof Error ? error.message : tDetail("loadError")
            }
            onRetry={() => refetch()}
          />
        )}

        {product && (
          <div className="space-y-5">
            {stockInNotice && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-950">
                {stockInNotice}
              </div>
            )}

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">{product.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {tDetail("listPrice")} {vnd.format(product.listPrice)}
                  </p>
                </div>
                {product.lowStock && <StatusBadge type="lowStock" />}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {tDetail("currentStock")}
                    </p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {product.stockQuantity}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {tDetail("avgCost")}
                    </p>
                    <p className="text-lg font-semibold tabular-nums tracking-tight break-words sm:text-2xl lg:text-3xl">
                      {formatCostPrice(
                        product.averageCostPrice,
                        tCommon("format.notSet")
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setStockInOpen(true)}>
                    {tDetail("stockIn")}
                  </Button>
                  {isOwner ? (
                    <Button
                      variant="outline"
                      onClick={() => setAdjustOpen(true)}
                    >
                      {tDetail("adjustStock")}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="history">
              <TabsList>
                <TabsTrigger value="history">
                  {tDetail("movementHistory")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="history" className="mt-4">
                <MovementHistory productId={product.id} />
              </TabsContent>
            </Tabs>

            <StockInForm
              open={stockInOpen}
              onOpenChange={setStockInOpen}
              defaultProductId={product.id}
              onSuccess={(products) => {
                const updated = products.find((p) => p.id === product.id);
                if (updated) {
                  setStockInNotice(
                    tDetail("stockInNotice", {
                      avgCost: formatCostPrice(
                        updated.averageCostPrice,
                        tCommon("format.notSet")
                      ),
                    })
                  );
                }
              }}
            />
            {isOwner ? (
              <StockAdjustmentForm
                open={adjustOpen}
                onOpenChange={setAdjustOpen}
                product={product}
              />
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
