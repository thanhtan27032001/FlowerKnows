"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import {
  productApi,
  productKeys,
  type ProductSortBy,
  type SortDir,
} from "@/src/lib/api/product";
import { formatCostPrice } from "@/src/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  onCreate: () => void;
  onStockIn: () => void;
};

function nextSort(
  currentBy: ProductSortBy | undefined,
  currentDir: SortDir | undefined,
  column: ProductSortBy
): { sortBy: ProductSortBy; sortDir: SortDir } {
  if (currentBy === column) {
    return { sortBy: column, sortDir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { sortBy: column, sortDir: "asc" };
}

export function ProductList({ onCreate, onStockIn }: Props) {
  const t = useTranslations("products.list");
  const tCommon = useTranslations("common");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [sortBy, setSortBy] = useState<ProductSortBy | undefined>();
  const [sortDir, setSortDir] = useState<SortDir | undefined>();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(handle);
  }, [q]);

  const listParams = useMemo(
    () => ({
      q: debouncedQ || undefined,
      sortBy,
      sortDir: sortBy ? sortDir : undefined,
    }),
    [debouncedQ, sortBy, sortDir]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: productKeys.list(listParams),
    queryFn: () => productApi.list(listParams),
  });

  const products = data ?? [];

  const SortHeader = ({
    column,
    label,
    align = "left",
  }: {
    column: ProductSortBy;
    label: string;
    align?: "left" | "right";
  }) => {
    const active = sortBy === column;
    const ariaSort = active
      ? sortDir === "asc"
        ? "ascending"
        : "descending"
      : "none";
    return (
      <TableHead
        aria-sort={ariaSort}
        className={align === "right" ? "text-right" : undefined}
      >
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 font-medium hover:text-foreground",
            align === "right" && "w-full justify-end",
            active ? "text-foreground" : "text-muted-foreground"
          )}
          onClick={() => {
            const next = nextSort(sortBy, sortDir, column);
            setSortBy(next.sortBy);
            setSortDir(next.sortDir);
          }}
        >
          {label}
          {active &&
            (sortDir === "asc" ? (
              <ArrowUpIcon className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <ArrowDownIcon className="size-3.5 shrink-0" aria-hidden />
            ))}
        </button>
      </TableHead>
    );
  };

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreate}>{t("createButton")}</Button>
        <Button
          variant="outline"
          onClick={onStockIn}
          disabled={isLoading}
        >
          {t("stockInButton")}
        </Button>
        <Link
          href="/stock-ledger"
          className={buttonVariants({ variant: "outline" })}
        >
          {t("stockLedgerButton")}
        </Link>
      </div>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="max-w-sm"
      />

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
            {debouncedQ ? t("searchEmpty") : t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && products.length > 0 && (
        <div className="fk-table-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader column="name" label={t("name")} />
                <SortHeader column="averageCostPrice" label={t("avgCost")} />
                <SortHeader
                  column="stockQuantity"
                  label={t("stock")}
                  align="right"
                />
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
