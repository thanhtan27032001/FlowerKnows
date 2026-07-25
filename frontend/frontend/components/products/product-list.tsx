"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, vnd } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  onCreate: () => void;
  onStockIn: () => void;
};

export function ProductList({ onCreate, onStockIn }: Props) {
  const t = useTranslations("products.list");
  const tCommon = useTranslations("common");
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
  });

  const products = data ?? [];

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreate}>{t("createButton")}</Button>
        <Button
          variant="outline"
          onClick={onStockIn}
          disabled={isLoading || products.length === 0}
        >
          {t("stockInButton")}
        </Button>
      </div>

      {isLoading && <ListSkeleton columns={5} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : t("loadError")
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && products.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="transition-colors duration-200 hover:bg-muted/30 motion-reduce:transition-none">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {product.name}
                      </CardTitle>
                      {product.lowStock && <StatusBadge type="lowStock" />}
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">{t("listPrice")}</p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(product.listPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("stock")}</p>
                      <p className="font-medium tabular-nums">
                        {product.stockQuantity}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">{t("avgCost")}</p>
                      <p className="font-medium tabular-nums">
                        {formatCostPrice(
                          product.averageCostPrice,
                          tCommon("format.notSet")
                        )}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("listPrice")}</TableHead>
                  <TableHead>{t("avgCost")}</TableHead>
                  <TableHead>{t("stock")}</TableHead>
                  <TableHead className="w-[120px]">{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vnd.format(product.listPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCostPrice(
                        product.averageCostPrice,
                        tCommon("format.notSet")
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {product.stockQuantity}
                    </TableCell>
                    <TableCell>
                      {product.lowStock ? (
                        <StatusBadge type="lowStock" />
                      ) : (
                        <span className="text-muted-foreground">
                          {tCommon("fallback.emDash")}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
