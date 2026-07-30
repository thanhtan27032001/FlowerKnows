"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice } from "@/src/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

      {isLoading && <ListSkeleton columns={3} />}

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
        <div className="fk-table-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("avgCost")}</TableHead>
                <TableHead className="text-right">{t("stock")}</TableHead>
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
                    {formatCostPrice(
                      product.averageCostPrice,
                      tCommon("format.notSet")
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-right">
                    {product.stockQuantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
