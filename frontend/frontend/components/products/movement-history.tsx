"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, formatDateTime } from "@/src/lib/format";
import { stockTxLabel } from "@/src/lib/i18n-labels";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  productId: string;
};

export function MovementHistory({ productId }: Props) {
  const t = useTranslations("products.history");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common");
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: productKeys.transactions(productId),
    queryFn: () => productApi.listStockTransactions(productId),
  });

  const rows = data ?? [];
  const mismatch = rows.some((row) => row.ledgerMismatch);

  return (
    <div className="relative space-y-3">
      <QueryProgressBar active={isFetching && !isLoading} />

      {isLoading && <ListSkeleton columns={6} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : t("loadError")
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Card className="border-border/70 bg-muted/20">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <>
          {mismatch && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
              Ledger mismatch: the sum of stock transactions does not equal the
              current stock quantity. Check for missing transaction writes.
            </div>
          )}

          <div className="grid gap-3 md:hidden">
            {rows.map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-2 pt-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium leading-snug">
                      {stockTxLabel(tStatus, row.type)}
                    </p>
                    <QuantityChange value={row.quantityChange} />
                  </div>
                  <p className="text-muted-foreground">
                    {formatDateTime(row.createdAt)}
                  </p>
                  {row.note && <p>{row.note}</p>}
                  {row.costPrice != null && (
                    <p className="text-muted-foreground">
                      {t("cost")}:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {formatCostPrice(
                          row.costPrice,
                          tCommon("format.notSet")
                        )}
                      </span>
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {t("balanceAfter")}:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {row.balanceAfter}
                    </span>
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("change")}</TableHead>
                  <TableHead>{t("cost")}</TableHead>
                  <TableHead>{t("note")}</TableHead>
                  <TableHead>{t("balanceAfter")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {stockTxLabel(tStatus, row.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <QuantityChange value={row.quantityChange} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.costPrice != null
                        ? formatCostPrice(
                            row.costPrice,
                            tCommon("format.notSet")
                          )
                        : tCommon("fallback.emDash")}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {row.note || tCommon("fallback.emDash")}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.balanceAfter}
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

function QuantityChange({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className={`font-medium tabular-nums ${
        positive
          ? "text-emerald-700"
          : value < 0
            ? "text-red-700"
            : "text-foreground"
      }`}
    >
      {positive ? `+${value}` : value}
    </span>
  );
}
