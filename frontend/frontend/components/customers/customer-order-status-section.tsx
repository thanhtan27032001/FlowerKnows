"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CustomerOrderSummary } from "@/src/lib/api/customer";
import {
  orderApi,
  orderKeys,
  SHIPPING_LABEL,
  SHIPPING_NEXT,
  type ShippingStatus,
} from "@/src/lib/api/order";
import { customerKeys } from "@/src/lib/api/customer";
import { formatDateTime, vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  customerId: string;
  latestOrder: CustomerOrderSummary;
  orders: CustomerOrderSummary[];
};

function statusVariant(status: string) {
  if (status === "COMPLETED") return "secondary" as const;
  if (status === "SHIPPED") return "default" as const;
  return "outline" as const;
}

function shippingLabel(status: string) {
  return SHIPPING_LABEL[status as ShippingStatus] ?? status;
}

function OrderShippingControls({
  customerId,
  order,
}: {
  customerId: string;
  order: CustomerOrderSummary;
}) {
  const queryClient = useQueryClient();
  const [carrierOrderId, setCarrierOrderId] = useState(
    order.carrierOrderId ?? ""
  );

  useEffect(() => {
    setCarrierOrderId(order.carrierOrderId ?? "");
  }, [order.id, order.carrierOrderId, order.shippingStatus]);

  const mutation = useMutation({
    mutationFn: (input: {
      shippingStatus: ShippingStatus;
      carrierOrderId: string;
    }) => orderApi.updateShippingStatus(order.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: customerKeys.detail(customerId),
      });
      await queryClient.invalidateQueries({ queryKey: orderKeys.all });
    },
  });

  const status = order.shippingStatus as ShippingStatus;
  const options = SHIPPING_NEXT[status] ?? [status];

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">Shipping status</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value || value === status) return;
              mutation.mutate({
                shippingStatus: value as ShippingStatus,
                carrierOrderId,
              });
            }}
            disabled={mutation.isPending || status === "COMPLETED"}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPPING_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Carrier order ID</Label>
          <div className="flex gap-2">
            <Input
              className="h-8"
              value={carrierOrderId}
              onChange={(e) => setCarrierOrderId(e.target.value)}
              placeholder="Not set yet"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                mutation.isPending ||
                carrierOrderId.trim() === (order.carrierOrderId ?? "")
              }
              onClick={() =>
                mutation.mutate({
                  shippingStatus: status,
                  carrierOrderId,
                })
              }
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerOrderStatusSection({
  customerId,
  latestOrder,
  orders,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const pastOrders = orders.slice(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Order shipping status</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Most recent order · {formatDateTime(latestOrder.createdAt)}
            </p>
          </div>
          <Badge variant={statusVariant(latestOrder.shippingStatus)}>
            {shippingLabel(latestOrder.shippingStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">Revenue</p>
            <p className="font-medium tabular-nums">
              {vnd.format(latestOrder.recognizedRevenue)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Items</p>
            <p className="font-medium tabular-nums">{latestOrder.tokenCount}</p>
          </div>
        </div>

        <OrderShippingControls customerId={customerId} order={latestOrder} />

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/orders?highlight=${latestOrder.id}`}
            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            Open in Orders
          </Link>
          {pastOrders.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? "Hide past orders"
                : `Show ${pastOrders.length} past order${pastOrders.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </div>

        {showAll && pastOrders.length > 0 && (
          <ul className="space-y-2 border-t border-border/60 pt-3">
            {pastOrders.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-border/70 bg-muted/20 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {formatDateTime(order.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {order.tokenCount} item
                      {order.tokenCount === 1 ? "" : "s"} ·{" "}
                      {vnd.format(order.recognizedRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Carrier ID: {order.carrierOrderId || "Not set yet"}
                    </p>
                  </div>
                  <Badge variant={statusVariant(order.shippingStatus)}>
                    {shippingLabel(order.shippingStatus)}
                  </Badge>
                </div>
                <div className="mt-3">
                  <OrderShippingControls
                    customerId={customerId}
                    order={order}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
