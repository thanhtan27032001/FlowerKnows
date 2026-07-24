"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CashOutForm } from "@/components/customers/cash-out-form";
import { CustomerTokenActionBar } from "@/components/customers/customer-token-action-bar";
import { HistoryTokenCard } from "@/components/customers/history-token-card";
import { HoldingTokenCard } from "@/components/customers/holding-token-card";
import { ItemExchangeForm } from "@/components/customers/item-exchange-form";
import { CreateOrderForm } from "@/components/orders/create-order-form";
import { CancelTokenDialog } from "@/components/tokens/cancel-token-dialog";
import { customerApi, customerKeys } from "@/src/lib/api/customer";
import { vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [cashOutOpen, setCashOutOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const {
    data: customer,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customerApi.get(id),
  });

  const selectedTokens = useMemo(() => {
    if (!customer) return [];
    return customer.holdingTokens.filter((t) => selectedIds.has(t.id));
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

  return (
    <AppShell
      title={customer?.name ?? "Customer"}
      actions={
        <Link
          href="/customers"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
      }
    >
      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading customer…</p>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load customer"}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {customer && (
        <div className="space-y-6 pb-36">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-xl">{customer.name}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {customer.phone || "No phone"}
                  {customer.address ? ` · ${customer.address}` : ""}
                </p>
              </div>
              {customer.overdueHoldingCount > 0 && (
                <Badge variant="destructive">
                  {customer.overdueHoldingCount} overdue
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Prepaid balance</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {vnd.format(customer.prepaidBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Sum of holding token values
              </p>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                Holding tokens
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
                        new Set(customer.holdingTokens.map((t) => t.id))
                      );
                    }
                  }}
                >
                  {selectedIds.size === customer.holdingTokens.length
                    ? "Clear"
                    : "Select all"}
                </Button>
              )}
            </div>

            {customer.holdingTokens.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  This customer has no items currently held
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
              History
            </h2>
            {customer.history.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No processed tokens yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {customer.history.map((token) => (
                  <HistoryTokenCard key={token.id} token={token} />
                ))}
              </div>
            )}
          </section>

          <CustomerTokenActionBar
            selectedCount={selectedIds.size}
            cancelEnabled={selectedIds.size === 1}
            onItemExchange={() => setExchangeOpen(true)}
            onCashOut={() => setCashOutOpen(true)}
            onCreateOrder={() => setOrderOpen(true)}
            onCancel={() => setCancelOpen(true)}
          />

          <ItemExchangeForm
            key={exchangeOpen ? `ex-${[...selectedIds].join(",")}` : "ex-closed"}
            open={exchangeOpen}
            onOpenChange={setExchangeOpen}
            customerId={customer.id}
            tokens={selectedTokens}
            onSuccess={clearSelection}
          />
          <CashOutForm
            key={cashOutOpen ? `co-${[...selectedIds].join(",")}` : "co-closed"}
            open={cashOutOpen}
            onOpenChange={setCashOutOpen}
            customerId={customer.id}
            tokens={selectedTokens}
            onSuccess={clearSelection}
          />
          <CreateOrderForm
            key={orderOpen ? `ord-${[...selectedIds].join(",")}` : "ord-closed"}
            open={orderOpen}
            onOpenChange={setOrderOpen}
            customerId={customer.id}
            tokens={selectedTokens}
            onSuccess={clearSelection}
          />
          {cancelToken && (
            <CancelTokenDialog
              open={cancelOpen}
              onOpenChange={setCancelOpen}
              tokenId={cancelToken.id}
              tokenValue={cancelToken.tokenValue}
              productName={cancelToken.productName}
              customerId={customer.id}
              onSuccess={clearSelection}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
