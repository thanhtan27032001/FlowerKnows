"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { CancelDirectSaleDialog } from "@/components/direct-sales/cancel-direct-sale-dialog";
import { CreateDirectSaleForm } from "@/components/direct-sales/create-direct-sale-form";
import { useAuth } from "@/components/providers/auth-provider";
import {
  directSaleApi,
  directSaleKeys,
  type DirectSale,
} from "@/src/lib/api/direct-sale";
import { formatDateTime, vnd } from "@/src/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DirectSaleCard({
  sale,
  canCancel,
  onCancel,
}: {
  sale: DirectSale;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const t = useTranslations("directSales.list");

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold tabular-nums">
              {vnd.format(sale.recognizedRevenue)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {sale.customerId && sale.customerName ? (
                <Link
                  href={`/customers/${sale.customerId}`}
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {sale.customerName}
                </Link>
              ) : (
                t("walkIn")
              )}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDateTime(sale.createdAt)}
            </p>
          </div>
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
            <p className="tabular-nums">{vnd.format(sale.totalCost)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("grossMargin")}</p>
            <p className="tabular-nums">{vnd.format(sale.grossMargin)}</p>
          </div>
        </div>
        {sale.missingCostWarning && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            {t("missingCost")}
          </p>
        )}
        <div className="space-y-1.5 border-t border-border/60 pt-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("items")}
          </p>
          {sale.lines.map((line) => (
            <div
              key={line.id}
              className="flex justify-between gap-3 text-sm"
            >
              <span>
                {line.productName}{" "}
                <span className="text-muted-foreground">
                  {t("qty", { qty: line.quantity })}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {vnd.format(line.unitPrice * line.quantity)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DirectSaleList() {
  const t = useTranslations("directSales");
  const tList = useTranslations("directSales.list");
  const { isOwner } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelSale, setCancelSale] = useState<DirectSale | null>(null);

  const { data: sales = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: directSaleKeys.lists(),
    queryFn: () => directSaleApi.list(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          {t("createButton")}
        </Button>
      </div>

      <QueryProgressBar active={isFetching && !isLoading} />

      {isLoading && <ListSkeleton rows={4} />}

      {isError && (
        <QueryErrorState
          message={tList("loadError")}
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && sales.length === 0 && (
        <Card className="border-border/70 bg-muted/20">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {tList("empty")}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && sales.length > 0 && (
        <div className="grid gap-3">
          {sales.map((sale) => (
            <DirectSaleCard
              key={sale.id}
              sale={sale}
              canCancel={isOwner}
              onCancel={() => setCancelSale(sale)}
            />
          ))}
        </div>
      )}

      <CreateDirectSaleForm open={createOpen} onOpenChange={setCreateOpen} />

      {cancelSale && (
        <CancelDirectSaleDialog
          open={!!cancelSale}
          onOpenChange={(next) => {
            if (!next) setCancelSale(null);
          }}
          sale={cancelSale}
        />
      )}
    </div>
  );
}
