"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { ProductTypeahead } from "@/components/products/product-typeahead";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { productApi, productKeys } from "@/src/lib/api/product";
import {
  stockLedgerApi,
  stockLedgerKeys,
  type StockTransactionType,
} from "@/src/lib/api/stock-ledger";
import { formatDateTime } from "@/src/lib/format";
import { stockTxLabel } from "@/src/lib/i18n-labels";

const PAGE_SIZE = 50;

const STOCK_TRANSACTION_TYPES: readonly StockTransactionType[] = [
  "STOCK_IN",
  "STOCK_ADJUSTMENT",
  "CAMPAIGN_LOCK",
  "CAMPAIGN_RETURN",
  "EXCHANGE_IN",
  "EXCHANGE_OUT",
  "CASH_OUT_RETURN",
  "TOKEN_CANCEL_RETURN",
  "ORDER_FULFILLMENT",
  "EXCHANGE_UNDO_RETURN",
  "EXCHANGE_UNDO_REMOVE",
] as const;

type AppliedFilters = {
  productId: string;
  type: string;
  dateFrom: string;
  dateTo: string;
};

export function StockLedgerList() {
  const t = useTranslations("stockLedger");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("common.status");

  const [productId, setProductId] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedFilters>({
    productId: "",
    type: "",
    dateFrom: "",
    dateTo: "",
  });

  const productsQuery = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
  });

  const ledgerQuery = useQuery({
    queryKey: stockLedgerKeys.list({
      page,
      size: PAGE_SIZE,
      productId: applied.productId || undefined,
      type: (applied.type || undefined) as StockTransactionType | undefined,
      dateFrom: applied.dateFrom || undefined,
      dateTo: applied.dateTo || undefined,
    }),
    queryFn: () =>
      stockLedgerApi.list({
        page,
        size: PAGE_SIZE,
        productId: applied.productId || undefined,
        type: (applied.type || undefined) as StockTransactionType | undefined,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
      }),
  });

  const rows = ledgerQuery.data?.content ?? [];
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;
  const totalPages = ledgerQuery.data?.totalPages ?? 0;
  const hasPrev = page > 0;
  const hasNext = Boolean(ledgerQuery.data?.hasNext);

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={ledgerQuery.isFetching && !ledgerQuery.isLoading} />

      <Card>
        <CardContent className="grid gap-4 pt-5 md:grid-cols-5">
          <div className="grid gap-2 md:col-span-2">
            <Label htmlFor="stock-ledger-product">{t("filters.product")}</Label>
            <ProductTypeahead
              id="stock-ledger-product"
              products={productsQuery.data ?? []}
              productId={productId}
              onSelect={(product) => setProductId(product?.id ?? "")}
              placeholder={t("filters.productPlaceholder")}
              disabled={productsQuery.isLoading}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("filters.type")}</Label>
            <Select
              value={type || "__all__"}
              onValueChange={(v) => {
                const next = String(v ?? "__all__");
                setType(next === "__all__" ? "" : next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("filters.allTypes")}>
                  {type ? stockTxLabel(tStatus, type) : t("filters.allTypes")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t("filters.allTypes")}</SelectItem>
                {STOCK_TRANSACTION_TYPES.map((txType) => (
                  <SelectItem key={txType} value={txType}>
                    {stockTxLabel(tStatus, txType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stock-ledger-date-from">{t("filters.dateFrom")}</Label>
            <Input
              id="stock-ledger-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="stock-ledger-date-to">{t("filters.dateTo")}</Label>
            <Input
              id="stock-ledger-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-5">
            <Button
              onClick={() => {
                setPage(0);
                setApplied({ productId, type, dateFrom, dateTo });
              }}
            >
              {tCommon("actions.apply")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setProductId("");
                setType("");
                setDateFrom("");
                setDateTo("");
                setPage(0);
                setApplied({ productId: "", type: "", dateFrom: "", dateTo: "" });
              }}
            >
              {tCommon("actions.clearFilters")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {ledgerQuery.isLoading && <ListSkeleton columns={5} />}

      {ledgerQuery.isError && (
        <QueryErrorState
          message={
            ledgerQuery.error instanceof Error
              ? ledgerQuery.error.message
              : t("loadError")
          }
          onRetry={() => ledgerQuery.refetch()}
        />
      )}

      {!ledgerQuery.isLoading && !ledgerQuery.isError && rows.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {!ledgerQuery.isLoading && !ledgerQuery.isError && rows.length > 0 && (
        <>
          <div className="grid gap-2 md:hidden">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedRowId(row.id)}
                className="rounded-xl border border-border/70 bg-card px-3 py-2 text-left shadow-xs transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{row.productName}</p>
                  <QuantityChange value={row.quantityChange} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDateTime(row.createdAt)}
                </p>
              </button>
            ))}
          </div>

          <Dialog
            open={selectedRow != null}
            onOpenChange={(open) => {
              if (!open) setSelectedRowId(null);
            }}
          >
            <DialogContent>
              {selectedRow && (
                <>
                  <DialogHeader>
                    <DialogTitle>{selectedRow.productName}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t("columns.dateTime")}
                      </span>
                      <span className="font-medium">
                        {formatDateTime(selectedRow.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t("columns.quantityChange")}
                      </span>
                      <QuantityChange value={selectedRow.quantityChange} />
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t("columns.type")}
                      </span>
                      <span className="text-right font-medium">
                        {stockTxLabel(tStatus, selectedRow.type)}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">
                        {t("columns.note")}
                      </span>
                      <span className="max-w-[70%] text-right font-medium">
                        {selectedRow.note || tCommon("fallback.emDash")}
                      </span>
                    </div>
                    <div className="pt-1">
                      <Link
                        href={`/products/${selectedRow.productId}`}
                        className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => setSelectedRowId(null)}
                      >
                        {t("columns.productName")}: {selectedRow.productName}
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          <div className="fk-table-surface hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.productName")}</TableHead>
                  <TableHead>{t("columns.dateTime")}</TableHead>
                  <TableHead>{t("columns.type")}</TableHead>
                  <TableHead className="text-right">{t("columns.quantityChange")}</TableHead>
                  <TableHead>{t("columns.note")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/products/${row.productId}`} className="font-medium hover:underline">
                        {row.productName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                    <TableCell>{stockTxLabel(tStatus, row.type)}</TableCell>
                    <TableCell className="text-right">
                      <QuantityChange value={row.quantityChange} />
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">
                      {row.note || tCommon("fallback.emDash")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("pagination.summary", {
                page: page + 1,
                totalPages: totalPages || 1,
                totalElements: ledgerQuery.data?.totalElements ?? rows.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={!hasPrev}
                onClick={() => setPage((prev) => Math.max(prev - 1, 0))}
              >
                {t("pagination.previous")}
              </Button>
              <Button
                variant="outline"
                disabled={!hasNext}
                onClick={() => setPage((prev) => prev + 1)}
              >
                {t("pagination.next")}
              </Button>
            </div>
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
