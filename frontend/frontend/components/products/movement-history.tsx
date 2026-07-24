"use client";

import { useQuery } from "@tanstack/react-query";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, formatDateTime } from "@/src/lib/format";
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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: productKeys.transactions(productId),
    queryFn: () => productApi.listStockTransactions(productId),
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading movement history…</p>;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : "Failed to load history"}
      </p>
    );
  }

  const rows = data ?? [];
  const mismatch = rows.some((row) => row.ledgerMismatch);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No stock movements recorded for this product yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mismatch && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900">
          Ledger mismatch: the sum of stock transactions does not equal the
          current stock quantity. Check for missing transaction writes.
        </div>
      )}

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-2 pt-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{row.typeLabel}</p>
                <QuantityChange value={row.quantityChange} />
              </div>
              <p className="text-muted-foreground">{formatDateTime(row.createdAt)}</p>
              {row.note && <p>{row.note}</p>}
              {row.costPrice != null && (
                <p className="text-muted-foreground">
                  Cost price:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {formatCostPrice(row.costPrice)}
                  </span>
                </p>
              )}
              <p className="text-muted-foreground">
                Balance after:{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {row.balanceAfter}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{row.typeLabel}</Badge>
                </TableCell>
                <TableCell>
                  <QuantityChange value={row.quantityChange} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.costPrice != null
                    ? formatCostPrice(row.costPrice)
                    : "—"}
                </TableCell>
                <TableCell className="max-w-[280px] truncate">
                  {row.note || "—"}
                </TableCell>
                <TableCell className="tabular-nums">{row.balanceAfter}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function QuantityChange({ value }: { value: number }) {
  const positive = value > 0;
  return (
    <span
      className={`font-medium tabular-nums ${
        positive ? "text-emerald-700" : value < 0 ? "text-red-700" : "text-foreground"
      }`}
    >
      {positive ? `+${value}` : value}
    </span>
  );
}
