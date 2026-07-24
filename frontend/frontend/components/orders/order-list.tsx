"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  orderApi,
  orderKeys,
  SHIPPING_LABEL,
  SHIPPING_NEXT,
  type Order,
  type ShippingStatus,
} from "@/src/lib/api/order";
import { customerKeys } from "@/src/lib/api/customer";
import { formatCostPrice, formatDateTime, vnd, vndCost } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function statusVariant(status: ShippingStatus) {
  if (status === "COMPLETED") return "secondary" as const;
  if (status === "SHIPPED") return "default" as const;
  return "outline" as const;
}

function OrderStatusSelect({ order }: { order: Order }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (shippingStatus: ShippingStatus) =>
      orderApi.updateShippingStatus(order.id, {
        shippingStatus,
        carrierOrderId: order.carrierOrderId,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(order.customerId),
      });
    },
  });

  const options = SHIPPING_NEXT[order.shippingStatus];

  return (
    <Select
      value={order.shippingStatus}
      onValueChange={(value) => {
        if (!value || value === order.shippingStatus) return;
        mutation.mutate(value as ShippingStatus);
      }}
      disabled={mutation.isPending || order.shippingStatus === "COMPLETED"}
    >
      <SelectTrigger className="h-8 w-[150px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((status) => (
          <SelectItem key={status} value={status}>
            {SHIPPING_LABEL[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function OrderList({ highlightId }: Props) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: orderKeys.lists(),
    queryFn: () => orderApi.list(),
  });

  const orders = data ?? [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading orders…</p>;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load orders"}
        </p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No orders yet. Create one from a customer&apos;s holding tokens.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {orders.map((order) => (
          <Card
            key={order.id}
            className={
              highlightId === order.id ? "ring-2 ring-primary/50" : undefined
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
                    {formatDateTime(order.createdAt)} · {order.tokens.length}{" "}
                    item{order.tokens.length === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant={statusVariant(order.shippingStatus)}>
                  {SHIPPING_LABEL[order.shippingStatus]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Revenue</p>
                  <p className="font-medium tabular-nums">
                    {vnd.format(order.recognizedRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total cost</p>
                  <p className="font-medium tabular-nums">
                    {vndCost.format(order.totalCost)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Gross margin</p>
                  <p className="font-medium tabular-nums">
                    {vndCost.format(order.grossMargin)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Carrier order ID</p>
                <p className="font-medium">
                  {order.carrierOrderId || "Not set yet"}
                </p>
              </div>
              <ul className="space-y-1.5 text-muted-foreground">
                {order.tokens.map((t) => (
                  <li key={t.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {t.productName}
                      <span className="mt-0.5 block text-xs">
                        Cost {formatCostPrice(t.costBasis)}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {vnd.format(t.tokenValue)}
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <p className="mb-1.5 text-muted-foreground">Shipping status</p>
                <OrderStatusSelect order={order} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border/80 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Total cost</TableHead>
              <TableHead>Gross margin</TableHead>
              <TableHead>Carrier ID</TableHead>
              <TableHead>Shipping</TableHead>
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
                <TableCell className="tabular-nums">{order.tokens.length}</TableCell>
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
                  {order.carrierOrderId || "Not set yet"}
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
  );
}
