"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { UndoExchangeDialog } from "@/components/customers/undo-exchange-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import {
  exchangeApi,
  exchangeKeys,
  type ExchangeHistoryItem,
  type TokenBrief,
} from "@/src/lib/api/exchange";
import { formatDateTime, vnd } from "@/src/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  customerId: string;
};

function tokenNames(tokens: TokenBrief[]) {
  if (tokens.length === 0) return "—";
  const counts = new Map<string, number>();
  for (const tok of tokens) {
    counts.set(tok.productName, (counts.get(tok.productName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => (count > 1 ? `${name} ×${count}` : name))
    .join(", ");
}

export function CustomerExchangeHistory({ customerId }: Props) {
  const t = useTranslations("customers.exchangeHistory");
  const { isOwner } = useAuth();
  const [undoTarget, setUndoTarget] = useState<ExchangeHistoryItem | null>(
    null
  );

  const {
    data: exchanges = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: exchangeKeys.byCustomer(customerId),
    queryFn: () => exchangeApi.listByCustomer(customerId),
  });

  return (
    <section className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
        {t("title")}
      </h2>

      {isLoading && (
        <div className="grid gap-3" aria-busy="true" aria-label={t("loading")}>
          {Array.from({ length: 2 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : t("loadError")
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && exchanges.length === 0 && (
        <Card className="border-border/70 bg-muted/20">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && exchanges.length > 0 && (
        <div className="grid gap-3">
          {exchanges.map((exchange) => (
            <Card key={exchange.id} className="fk-card-shadow">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-base">
                    {t("itemExchange")}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(exchange.createdAt)}
                  </p>
                </div>
                {isOwner &&
                  (exchange.undoEligible ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setUndoTarget(exchange)}
                    >
                      {t("undo")}
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span className="inline-flex cursor-not-allowed">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              disabled
                            >
                              {t("undo")}
                            </Button>
                          </span>
                        }
                      />
                      <TooltipContent>{t("undoBlockedTooltip")}</TooltipContent>
                    </Tooltip>
                  ))}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">{t("gaveUp")}</p>
                  <p className="font-medium leading-snug">
                    {tokenNames(exchange.tokensIn)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t("received")}</p>
                  <p className="font-medium leading-snug">
                    {tokenNames(exchange.tokensOut)}
                  </p>
                </div>
                {exchange.additionalPayment != null &&
                  exchange.additionalPayment !== 0 && (
                    <div>
                      <p className="text-muted-foreground">
                        {t("additionalPayment")}
                      </p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(exchange.additionalPayment)}
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isOwner && undoTarget && (
        <UndoExchangeDialog
          open={!!undoTarget}
          onOpenChange={(next) => {
            if (!next) setUndoTarget(null);
          }}
          exchange={undoTarget}
          customerId={customerId}
          onSuccess={() => setUndoTarget(null)}
        />
      )}
    </section>
  );
}
