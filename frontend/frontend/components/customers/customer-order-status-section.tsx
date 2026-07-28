"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import type { CustomerOrderSummary } from "@/src/lib/api/customer";
import {
  orderApi,
  orderKeys,
  SHIPPING_NEXT,
  type ShippingStatus,
} from "@/src/lib/api/order";
import { customerKeys } from "@/src/lib/api/customer";
import { shippingStatusLabel } from "@/src/lib/i18n-labels";
import { formatDateTime, vnd } from "@/src/lib/format";
import { useAuth } from "@/components/providers/auth-provider";
import { PendingButton } from "@/components/feedback/pending-button";
import { StatusBadge } from "@/components/shared/status-badge";
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

function OrderShippingControls({
  customerId,
  order,
}: {
  customerId: string;
  order: CustomerOrderSummary;
}) {
  const t = useTranslations("customers.orderStatus");
  const tStatus = useTranslations("common.status");
  const tCommon = useTranslations("common");
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
  const locked = mutation.isPending;

  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.isError
        ? t("saveFailed")
        : null;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("shippingStatus")}</Label>
          <Select
            value={status}
            onValueChange={(value) => {
              if (!value || value === status) return;
              mutation.mutate({
                shippingStatus: value as ShippingStatus,
                carrierOrderId,
              });
            }}
            disabled={locked || status === "COMPLETED"}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue>{shippingStatusLabel(tStatus, status)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((s) => (
                <SelectItem key={s} value={s}>
                  {shippingStatusLabel(tStatus, s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">{t("carrierOrderId")}</Label>
          <div className="flex gap-2">
            <Input
              className="h-8"
              value={carrierOrderId}
              onChange={(e) => setCarrierOrderId(e.target.value)}
              placeholder={t("notSetYet")}
              disabled={locked}
            />
            <PendingButton
              type="button"
              size="sm"
              variant="outline"
              pending={mutation.isPending}
              pendingLabel={tCommon("pending.saving")}
              disabled={
                carrierOrderId.trim() === (order.carrierOrderId ?? "")
              }
              onClick={() =>
                mutation.mutate({
                  shippingStatus: status,
                  carrierOrderId,
                })
              }
            >
              {t("save")}
            </PendingButton>
          </div>
        </div>
      </div>
      {errorMessage && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}

export function CustomerOrderStatusSection({
  customerId,
  latestOrder,
  orders,
}: Props) {
  const t = useTranslations("customers.orderStatus");
  const { isOwner } = useAuth();
  const [showAll, setShowAll] = useState(false);
  const pastOrders = orders.slice(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{t("title")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(latestOrder.createdAt)}
            </p>
          </div>
          <StatusBadge
            type="shipping"
            status={latestOrder.shippingStatus as ShippingStatus}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-muted-foreground">{t("revenue")}</p>
            <p className="font-medium tabular-nums">
              {vnd.format(latestOrder.recognizedRevenue)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("items")}</p>
            <p className="font-medium tabular-nums">{latestOrder.tokenCount}</p>
          </div>
        </div>

        {isOwner ? (
          <OrderShippingControls customerId={customerId} order={latestOrder} />
        ) : (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">{t("carrierOrderId")}</p>
            <p className="font-medium">
              {latestOrder.carrierOrderId || t("notSetYet")}
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Link
              href={`/orders?highlight=${latestOrder.id}`}
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              {t("openInOrders")}
            </Link>
          ) : null}
          {pastOrders.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll
                ? t("hidePast")
                : t("showPast", { count: pastOrders.length })}
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
                      {order.tokenCount} {t("items").toLowerCase()} ·{" "}
                      {vnd.format(order.recognizedRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("carrierIdLabel", {
                        id: order.carrierOrderId || t("notSetYet"),
                      })}
                    </p>
                  </div>
                  <StatusBadge
                    type="shipping"
                    status={order.shippingStatus as ShippingStatus}
                  />
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
