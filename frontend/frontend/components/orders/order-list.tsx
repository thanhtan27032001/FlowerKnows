"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, ImageIcon } from "lucide-react";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { Spinner } from "@/components/feedback/spinner";
import { OrderExportPreview } from "@/components/orders/order-export-preview";
import { useAuth } from "@/components/providers/auth-provider";
import {
  CopyButton,
  formatPhoneWithAddress,
} from "@/components/shared/copy-button";
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
import { SHIPPING_STATUS_COLORS } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const colors = SHIPPING_STATUS_COLORS[order.shippingStatus];

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
          <SelectTrigger
            className="h-7 w-fit max-w-[8rem] gap-1 px-2 text-xs font-medium"
            style={{
              backgroundColor: colors.bg,
              color: colors.fg,
              borderColor: colors.border,
            }}
          >
            <SelectValue>
              {shippingStatusLabel(tStatus, order.shippingStatus)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((status) => {
              const optionColors = SHIPPING_STATUS_COLORS[status];
              return (
                <SelectItem key={status} value={status}>
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: optionColors.bg }}
                      aria-hidden
                    />
                    {shippingStatusLabel(tStatus, status)}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {mutation.isPending && (
          <Spinner className="size-3.5 text-muted-foreground" />
        )}
      </div>
      {localError && <p className="text-xs text-destructive">{localError}</p>}
    </div>
  );
}

function OrderCard({
  order,
  highlighted,
  selectable,
  selected,
  onToggleSelect,
}: {
  order: Order;
  highlighted: boolean;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const t = useTranslations("orders.list");
  const tCommon = useTranslations("common");
  const [expanded, setExpanded] = useState(highlighted);

  return (
    <Card
      className={cn(
        "gap-0",
        highlighted
          ? "fk-card-shadow fk-card-shadow-hover ring-2 ring-primary/50"
          : "fk-card-shadow fk-card-shadow-hover",
        selected && "bg-primary/5"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        className="w-full cursor-pointer text-left"
      >
        <CardHeader className={cn(expanded ? "pb-3" : "pb-0")}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ChevronDownIcon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  expanded && "rotate-180"
                )}
              />
              <div className="min-w-0">
                <CardTitle className="text-base leading-snug">
                  <Link
                    href={`/customers/${order.customerId}`}
                    className="hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {order.customerName}
                  </Link>
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDateTime(order.createdAt)} ·{" "}
                  {t("itemsCount", { count: order.tokens.length })}
                </p>
              </div>
            </div>
            <div
              className="flex shrink-0 items-center gap-2"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <OrderStatusSelect order={order} />
              {selectable && (
                <input
                  type="checkbox"
                  className="size-4 shrink-0 rounded border-border accent-primary"
                  checked={selected}
                  onChange={onToggleSelect}
                  aria-label={t("selectOrder")}
                />
              )}
            </div>
          </div>
        </CardHeader>
      </div>

      <CardContent
        className={cn("space-y-3 pt-0 text-sm", !expanded && "hidden")}
      >
        <div className="space-y-3 border-t border-border/60 pt-3">
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
              <p
                className={cn(
                  "font-medium tabular-nums",
                  order.grossMargin < 0 && "text-destructive"
                )}
              >
                {vndCost.format(order.grossMargin)}
              </p>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground">{t("shippingContact")}</p>
            <div className="flex items-start gap-1">
              <div className="min-w-0">
                <p className="font-medium">
                  {order.customerPhone?.trim() || tCommon("fallback.noPhone")}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground break-words">
                  {order.customerAddress?.trim() || t("notSetYet")}
                </p>
              </div>
              <CopyButton
                text={formatPhoneWithAddress(
                  order.customerPhone,
                  order.customerAddress
                )}
                label={t("copyContact")}
                disabled={
                  !order.customerPhone?.trim() && !order.customerAddress?.trim()
                }
              />
            </div>
          </div>

          <div>
            <p className="text-muted-foreground">{t("carrierOrderId")}</p>
            <div className="flex items-center gap-1">
              <p className="min-w-0 font-medium break-all">
                {order.carrierOrderId || t("notSetYet")}
              </p>
              <CopyButton
                text={order.carrierOrderId ?? ""}
                label={t("copyCarrierId")}
                disabled={!order.carrierOrderId?.trim()}
              />
            </div>
          </div>

          <ul className="space-y-1.5 text-muted-foreground">
            {order.tokens.map((token) => (
              <li key={token.id} className="min-w-0">
                <p className="truncate text-foreground">{token.productName}</p>
                <p className="mt-0.5 truncate text-xs tabular-nums">
                  {t("costLabel", {
                    cost: formatCostPrice(
                      token.costBasis,
                      tCommon("format.notSet")
                    ),
                    price: vnd.format(token.tokenValue),
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrderList({ highlightId }: Props) {
  const t = useTranslations("orders.list");
  const tExport = useTranslations("common.export");
  const tCommon = useTranslations("common");
  const { isOwner } = useAuth();
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: orderKeys.lists(),
    queryFn: () => orderApi.list(),
  });

  const orders = data ?? [];
  const selectedOrders = useMemo(
    () => (data ?? []).filter((order) => selectedIds.has(order.id)),
    [data, selectedIds]
  );

  const allSelected =
    orders.length > 0 && selectedIds.size === orders.length;

  const toggleSelect = (orderId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(orders.map((order) => order.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelecting(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      {isOwner && !isLoading && !isError && orders.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {!selecting ? (
            <Button type="button" variant="outline" onClick={() => setSelecting(true)}>
              {t("enterSelectMode")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setPreviewOpen(true)}
              >
                <ImageIcon data-icon="inline-start" />
                {tExport("button")}
                {selectedIds.size > 0 ? ` (${selectedIds.size})` : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={allSelected ? clearSelection : selectAll}
              >
                {allSelected
                  ? tCommon("actions.clear")
                  : tCommon("actions.selectAll")}
              </Button>
              <Button type="button" variant="outline" onClick={exitSelectMode}>
                {tCommon("actions.cancel")}
              </Button>
            </>
          )}
        </div>
      )}

      {isLoading && <ListSkeleton cardsOnly />}

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
        <div className="grid gap-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              highlighted={highlightId === order.id}
              selectable={isOwner && selecting}
              selected={selectedIds.has(order.id)}
              onToggleSelect={() => toggleSelect(order.id)}
            />
          ))}
        </div>
      )}

      {isOwner && (
        <OrderExportPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          orders={selectedOrders}
        />
      )}
    </div>
  );
}
