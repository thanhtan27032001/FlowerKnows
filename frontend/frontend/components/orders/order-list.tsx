"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { Spinner } from "@/components/feedback/spinner";
import {
  orderApi,
  orderKeys,
  SHIPPING_NEXT,
  type Order,
  type ShippingStatus,
} from "@/src/lib/api/order";
import { customerKeys } from "@/src/lib/api/customer";
import { formatCostPrice, formatDateTime, vnd, vndCost } from "@/src/lib/format";
import { shippingStatusLabel } from "@/src/lib/i18n-labels";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type Props = {
  highlightId?: string | null;
};

function OrderStatusSelect({ order }: { order: Order }) {
  const t = useTranslations("orders.list");
  const tStatus = useTranslations("common.status");
  const queryClient = useQueryClient();
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (shippingStatus: ShippingStatus) =>
      orderApi.updateShippingStatus(order.id, {
        shippingStatus,
        carrierOrderId: order.carrierOrderId,
      }),
    onSuccess: async () => {
      setLocalError(null);
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(order.customerId),
      });
    },
    onError: (err: unknown) => {
      setLocalError(
        err instanceof Error ? err.message : t("updateShippingFailed")
      );
    },
  });

  const options = SHIPPING_NEXT[order.shippingStatus];

  return (
    <div className="space-y-1">
      <div className="relative inline-flex items-center gap-1.5">
        <Select
          value={order.shippingStatus}
          onValueChange={(value) => {
            if (!value || value === order.shippingStatus) return;
            setLocalError(null);
            mutation.mutate(value as ShippingStatus);
          }}
          disabled={mutation.isPending || order.shippingStatus === "COMPLETED"}
        >
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue>
              {shippingStatusLabel(tStatus, order.shippingStatus)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((status) => (
              <SelectItem key={status} value={status}>
                {shippingStatusLabel(tStatus, status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mutation.isPending && <Spinner className="size-3.5 text-muted-foreground" />}
      </div>
      {localError && (
        <p className="text-xs text-destructive">{localError}</p>
      )}
    </div>
  );
}

export function OrderList({ highlightId }: Props) {
  const t = useTranslations("orders.list");
  const tCommon = useTranslations("common");
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: orderKeys.lists(),
    queryFn: () => orderApi.list(),
  });

  const orders = data ?? [];

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      {isLoading && <ListSkeleton columns={8} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : t("loadError")
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && orders.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {orders.map((order) => (
              <Card
                key={order.id}
                className={
                  highlightId === order.id
                    ? "fk-card-shadow fk-card-shadow-hover ring-2 ring-primary/50"
                    : "fk-card-shadow fk-card-shadow-hover"
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base leading-snug">
                        <Link
                          href={`/customers/${order.customerId}`}
                          className="hover:underline"
                        >
                          {order.customerName}
                        </Link>
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(order.createdAt)} ·{" "}
                        {t("itemsCount", { count: order.tokens.length })}
                      </p>
                    </div>
                    <StatusBadge
                      type="shipping"
                      status={order.shippingStatus}
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">{t("revenue")}</p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(order.recognizedRevenue)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("totalCost")}</p>
                      <p className="font-medium tabular-nums">
                        {vndCost.format(order.totalCost)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t("grossMargin")}</p>
                      <p className="font-medium tabular-nums">
                        {vndCost.format(order.grossMargin)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t("carrierOrderId")}</p>
                    <p className="font-medium">
                      {order.carrierOrderId || t("notSetYet")}
                    </p>
                  </div>
                  <ul className="space-y-1.5 text-muted-foreground">
                    {order.tokens.map((token) => (
                      <li key={token.id} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          {token.productName}
                          <span className="mt-0.5 block text-xs">
                            {t("costLabel", {
                              cost: formatCostPrice(
                                token.costBasis,
                                tCommon("format.notSet")
                              ),
                            })}
                          </span>
                        </span>
                        <span className="shrink-0 tabular-nums text-foreground">
                          {vnd.format(token.tokenValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div>
                    <p className="mb-1.5 text-muted-foreground">
                      {t("shippingStatus")}
                    </p>
                    <OrderStatusSelect order={order} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="fk-table-surface hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("created")}</TableHead>
                  <TableHead>{t("items")}</TableHead>
                  <TableHead>{t("revenue")}</TableHead>
                  <TableHead>{t("totalCost")}</TableHead>
                  <TableHead>{t("grossMargin")}</TableHead>
                  <TableHead>{t("carrierId")}</TableHead>
                  <TableHead>{t("shipping")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className={
                      highlightId === order.id ? "bg-primary/5" : undefined
                    }
                  >
                    <TableCell>
                      <Link
                        href={`/customers/${order.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {order.customerName}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                    <TableCell className="tabular-nums">
                      {order.tokens.length}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vnd.format(order.recognizedRevenue)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vndCost.format(order.totalCost)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vndCost.format(order.grossMargin)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate text-muted-foreground">
                      {order.carrierOrderId || t("notSetYet")}
                    </TableCell>
                    <TableCell>
                      <OrderStatusSelect order={order} />
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
