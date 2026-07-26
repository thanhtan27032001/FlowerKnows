"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { CashOutForm } from "@/components/customers/cash-out-form";
import { CustomerActionStatusSelect } from "@/components/customers/customer-action-status-select";
import { CustomerOrderStatusSection } from "@/components/customers/customer-order-status-section";
import { CustomerTokenActionBar } from "@/components/customers/customer-token-action-bar";
import { HistoryTokenCard } from "@/components/customers/history-token-card";
import { HoldingTokenCard } from "@/components/customers/holding-token-card";
import { ItemExchangeForm } from "@/components/customers/item-exchange-form";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { CancelTokenDialog } from "@/components/tokens/cancel-token-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useFlashIds } from "@/hooks/use-flash-ids";
import { customerApi, customerKeys } from "@/src/lib/api/customer";
import { vnd } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function CustomerDetailSkeleton() {
  const tA11y = useTranslations("common.a11y");
  return (
    <div className="space-y-6" aria-busy="true" aria-label={tA11y("loading")}>
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-36" />
        </CardContent>
      </Card>
      <Skeleton className="h-6 w-36" />
      <div className="grid gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-2/3" />
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("customers");
  const tDetail = useTranslations("customers.detail");
  const tCommon = useTranslations("common");
  const { isOwner } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const { flashIds, flash } = useFlashIds();

  const {
    data: customer,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customerApi.get(id),
  });

  const selectedTokens = useMemo(() => {
    if (!customer) return [];
    return customer.holdingTokens.filter((tok) => selectedIds.has(tok.id));
  }, [customer, selectedIds]);

  const cancelToken =
    selectedTokens.length === 1 ? selectedTokens[0] : null;

  const toggleToken = (tokenId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const flashThenClear = (ids: Iterable<string>) => {
    flash(ids);
    clearSelection();
  };

  return (
    <AppShell
      title={customer?.name ?? t("detailFallbackTitle")}
      actions={
        <Link
          href="/customers"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {tCommon("actions.back")}
        </Link>
      }
    >
      <div className="relative">
        <QueryProgressBar active={isFetching && !isLoading} />

        {isLoading && <CustomerDetailSkeleton />}

        {isError && (
          <QueryErrorState
            message={
              error instanceof Error ? error.message : tDetail("loadError")
            }
            onRetry={() => refetch()}
          />
        )}

        {customer && (
          <div className="space-y-6 pb-40 lg:pb-28">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0 space-y-2">
                  <CardTitle className="text-xl">{customer.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {customer.phone || tCommon("fallback.noPhone")}
                    {customer.address ? ` · ${customer.address}` : ""}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {tDetail("actionStatus")}
                    </span>
                    <CustomerActionStatusSelect
                      customerId={customer.id}
                      value={customer.actionStatus}
                    />
                  </div>
                </div>
                {customer.overdueHoldingCount > 0 && (
                  <StatusBadge variant="danger">
                    {tDetail("overdueCount", {
                      count: customer.overdueHoldingCount,
                    })}
                  </StatusBadge>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {tDetail("prepaidBalance")}
                </p>
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {vnd.format(customer.prepaidBalance)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tDetail("prepaidHint")}
                </p>
              </CardContent>
            </Card>

            {customer.latestOrder && (
              <CustomerOrderStatusSection
                customerId={customer.id}
                latestOrder={customer.latestOrder}
                orders={customer.orders}
              />
            )}

            <section className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  {tDetail("holdingTokens")}
                </h2>
                {customer.holdingTokens.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (selectedIds.size === customer.holdingTokens.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(
                          new Set(customer.holdingTokens.map((tok) => tok.id))
                        );
                      }
                    }}
                  >
                    {selectedIds.size === customer.holdingTokens.length
                      ? tCommon("actions.clear")
                      : tCommon("actions.selectAll")}
                  </Button>
                )}
              </div>

              {customer.holdingTokens.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    {tDetail("holdingEmpty")}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {customer.holdingTokens.map((token) => (
                    <HoldingTokenCard
                      key={token.id}
                      token={token}
                      selected={selectedIds.has(token.id)}
                      onToggle={() => toggleToken(token.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                {tDetail("history")}
              </h2>
              {customer.history.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    {tDetail("historyEmpty")}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {customer.history.map((token) => (
                    <HistoryTokenCard
                      key={token.id}
                      token={token}
                      highlighted={flashIds.has(token.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <CustomerTokenActionBar
              selectedCount={selectedIds.size}
              cancelEnabled={selectedIds.size === 1}
              showActions={isOwner}
              onItemExchange={() => setExchangeOpen(true)}
              onCashOut={() => setCashOutOpen(true)}
              onCreateOrder={() => setOrderOpen(true)}
              onCancel={() => setCancelOpen(true)}
            />

            {isOwner ? (
              <>
                <ItemExchangeForm
                  key={
                    exchangeOpen
                      ? `ex-${[...selectedIds].join(",")}`
                      : "ex-closed"
                  }
                  open={exchangeOpen}
                  onOpenChange={setExchangeOpen}
                  customerId={customer.id}
                  tokens={selectedTokens}
                  onSuccess={() => flashThenClear([...selectedIds])}
                />
                <CashOutForm
                  key={
                    cashOutOpen
                      ? `co-${[...selectedIds].join(",")}`
                      : "co-closed"
                  }
                  open={cashOutOpen}
                  onOpenChange={setCashOutOpen}
                  customerId={customer.id}
                  tokens={selectedTokens}
                  onSuccess={() => flashThenClear([...selectedIds])}
                />
                <CreateOrderForm
                  key={
                    orderOpen
                      ? `ord-${[...selectedIds].join(",")}`
                      : "ord-closed"
                  }
                  open={orderOpen}
                  onOpenChange={setOrderOpen}
                  customerId={customer.id}
                  tokens={selectedTokens}
                  onSuccess={() => flashThenClear([...selectedIds])}
                />
                {cancelToken && (
                  <CancelTokenDialog
                    open={cancelOpen}
                    onOpenChange={setCancelOpen}
                    tokenId={cancelToken.id}
                    tokenValue={cancelToken.tokenValue}
                    productName={cancelToken.productName}
                    customerId={customer.id}
                    onSuccess={() => flashThenClear([cancelToken.id])}
                  />
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
