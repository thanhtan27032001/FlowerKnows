"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ACTION_STATUS_VALUES,
  customerApi,
  customerKeys,
  type Customer,
  type CustomerActionStatus,
  type CustomerSortBy,
  type SortDir,
} from "@/src/lib/api/customer";
import { type ShippingStatus } from "@/src/lib/api/order";
import {
  actionStatusLabel,
  shippingStatusLabel,
} from "@/src/lib/i18n-labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

const SHIPPING_FILTER_VALUES: ShippingStatus[] = [
  "ORDER_CREATED",
  "SHIPPED",
  "COMPLETED",
];

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  actionStatus: CustomerActionStatus | "";
  onActionStatusChange: (value: CustomerActionStatus | "") => void;
  shippingStatus: ShippingStatus | "";
  onShippingStatusChange: (value: ShippingStatus | "") => void;
  onCreate: () => void;
  onEdit: (customer: Customer) => void;
};

function nextSort(
  currentBy: CustomerSortBy | undefined,
  currentDir: SortDir | undefined,
  column: CustomerSortBy
): { sortBy: CustomerSortBy; sortDir: SortDir } {
  if (currentBy === column) {
    return { sortBy: column, sortDir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { sortBy: column, sortDir: "asc" };
}

function SortHeader({
  column,
  label,
  sortBy,
  sortDir,
  onSort,
}: {
  column: CustomerSortBy;
  label: string;
  sortBy: CustomerSortBy | undefined;
  sortDir: SortDir | undefined;
  onSort: (column: CustomerSortBy) => void;
}) {
  const active = sortBy === column;
  const ariaSort = active
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <TableHead aria-sort={ariaSort}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground"
        )}
        onClick={() => onSort(column)}
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
}

export function CustomerSearchList({
  query,
  onQueryChange,
  actionStatus,
  onActionStatusChange,
  shippingStatus,
  onShippingStatusChange,
  onCreate,
  onEdit,
}: Props) {
  const t = useTranslations("customers.search");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common");
  const [sortBy, setSortBy] = useState<CustomerSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const searchParams = {
    q: query,
    actionStatus,
    shippingStatus,
    sortBy,
    sortDir,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: customerKeys.search(searchParams),
    queryFn: () => customerApi.search(searchParams),
  });

  const customers = data ?? [];
  const hasFilters = !!actionStatus || !!shippingStatus;

  const handleSort = (column: CustomerSortBy) => {
    const next = nextSort(sortBy, sortDir, column);
    setSortBy(next.sortBy);
    setSortDir(next.sortDir);
  };

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("placeholder")}
          className="sm:max-w-sm"
          aria-label={tCommon("a11y.searchCustomers")}
        />
        <Button onClick={onCreate} className="sm:ml-auto">
          {t("createButton")}
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={actionStatus || "__all__"}
          onValueChange={(value) => {
            const next = String(value ?? "");
            onActionStatusChange(
              next === "__all__" ? "" : (next as CustomerActionStatus)
            );
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label={t("actionStatus")}
          >
            <SelectValue placeholder={t("actionStatus")}>
              {actionStatus
                ? actionStatusLabel(tStatus, actionStatus)
                : t("allActionStatuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allActionStatuses")}</SelectItem>
            {ACTION_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {actionStatusLabel(tStatus, status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={shippingStatus || "__all__"}
          onValueChange={(value) => {
            const next = String(value ?? "");
            onShippingStatusChange(
              next === "__all__" ? "" : (next as ShippingStatus)
            );
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label={t("shippingStatus")}
          >
            <SelectValue placeholder={t("shippingStatus")}>
              {shippingStatus
                ? shippingStatusLabel(tStatus, shippingStatus)
                : t("allShippingStatuses")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t("allShippingStatuses")}</SelectItem>
            {SHIPPING_FILTER_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {shippingStatusLabel(tStatus, status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onActionStatusChange("");
              onShippingStatusChange("");
            }}
          >
            {tCommon("actions.clearFilters")}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={
            actionStatus === "NEEDS_IMMEDIATE_ORDER" ? "default" : "outline"
          }
          onClick={() =>
            onActionStatusChange(
              actionStatus === "NEEDS_IMMEDIATE_ORDER"
                ? ""
                : "NEEDS_IMMEDIATE_ORDER"
            )
          }
        >
          {t("needsOrderNow")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={shippingStatus === "ORDER_CREATED" ? "default" : "outline"}
          onClick={() =>
            onShippingStatusChange(
              shippingStatus === "ORDER_CREATED" ? "" : "ORDER_CREATED"
            )
          }
        >
          {t("notYetShipped")}
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

      {!isLoading && !isError && customers.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {query.trim() || hasFilters ? t("emptyFiltered") : t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && customers.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="fk-card-shadow fk-card-shadow-hover transition-colors duration-200 hover:bg-muted/30 motion-reduce:transition-none"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="min-w-0 space-y-1"
                    >
                      <CardTitle className="text-base leading-snug">
                        {customer.name}
                      </CardTitle>
                      {customer.note?.trim() ? (
                        <p className="line-clamp-2 text-[10px] font-light leading-tight text-muted-foreground">
                          <span className="font-semibold">Note:</span>{" "}
                          {customer.note}
                        </p>
                      ) : null}
                      <p className="text-sm text-muted-foreground">
                        {customer.phone || tCommon("fallback.noPhone")}
                      </p>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(customer)}
                    >
                      {tCommon("actions.edit")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Link href={`/customers/${customer.id}`}>
                    <StatusBadge type="action" status={customer.actionStatus} />
                  </Link>
                  <Link href={`/customers/${customer.id}`}>
                    <StatusBadge
                      type="shipping"
                      status={customer.latestShippingStatus}
                    />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="fk-table-surface hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader
                    column="name"
                    label={t("columns.name")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    column="phone"
                    label={t("columns.phone")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    column="actionStatus"
                    label={t("columns.actionStatus")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    column="shippingStatus"
                    label={t("columns.shippingStatus")}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="w-[1%] text-right">
                    {tCommon("actions.edit")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="min-w-0 space-y-0.5">
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium hover:underline"
                        >
                          {customer.name}
                        </Link>
                        {customer.note?.trim() ? (
                          <p className="line-clamp-2 text-[10px] font-light leading-tight text-muted-foreground">
                            <span className="font-semibold">Note:</span>{" "}
                            {customer.note}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.phone || tCommon("fallback.emDash")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        type="action"
                        status={customer.actionStatus}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        type="shipping"
                        status={customer.latestShippingStatus}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(customer)}
                      >
                        {tCommon("actions.edit")}
                      </Button>
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
