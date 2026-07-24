"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { MovementHistory } from "@/components/products/movement-history";
import { StockAdjustmentForm } from "@/components/products/stock-adjustment-form";
import { StockInForm } from "@/components/products/stock-in-form";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [stockInOpen, setStockInOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [stockInNotice, setStockInNotice] = useState<string | null>(null);

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => productApi.get(id),
  });

  return (
    <AppShell
      title={product?.name ?? "Product"}
      actions={
        <Link
          href="/products"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
      }
    >
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading product…</p>
      )}

      {isError && (
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load product"}
        </p>
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
                  List price {vnd.format(product.listPrice)}
                </p>
              </div>
              {product.lowStock && <Badge variant="destructive">Low stock</Badge>}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Current stock</p>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                    {product.stockQuantity}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">
                    Average cost price
                  </p>
                  <p className="text-lg font-semibold tabular-nums tracking-tight break-words sm:text-2xl lg:text-3xl">
                    {formatCostPrice(product.averageCostPrice)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setStockInOpen(true)}>Stock In</Button>
                <Button variant="outline" onClick={() => setAdjustOpen(true)}>
                  Adjust Stock
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="history">
            <TabsList>
              <TabsTrigger value="history">Movement History</TabsTrigger>
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
                  `Stock in saved. Average cost price is now ${formatCostPrice(updated.averageCostPrice)}.`
                );
              }
            }}
          />
          <StockAdjustmentForm
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            product={product}
          />
        </div>
      )}
    </AppShell>
  );
}
