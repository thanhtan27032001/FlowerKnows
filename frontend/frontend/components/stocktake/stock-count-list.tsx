"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { CreateStockCountDialog } from "@/components/stocktake/create-stock-count-dialog";
import {
  stockCountApi,
  stockCountKeys,
  type StockCountSummary,
} from "@/src/lib/api/stock-count";
import { formatDateTime } from "@/src/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function StockCountCard({
  stockCount,
  linkLabel,
}: {
  stockCount: StockCountSummary;
  linkLabel: string;
}) {
  const t = useTranslations("stocktake.list");

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base font-semibold">
              {stockCount.note?.trim() || t("lineCount", { count: stockCount.lineCount })}
            </CardTitle>
            <p className="text-xs text-muted-foreground tabular-nums">
              {stockCount.completedAt
                ? t("completedAt", { time: formatDateTime(stockCount.completedAt) })
                : t("startedAt", { time: formatDateTime(stockCount.createdAt) })}
            </p>
          </div>
          <Link
            href={`/stocktake/${stockCount.id}`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            {linkLabel}
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground">
          {t("lineCount", { count: stockCount.lineCount })}
        </p>
      </CardContent>
    </Card>
  );
}

function StockCountSection({
  stockCounts,
  isLoading,
  isError,
  onRetry,
  emptyLabel,
  linkLabel,
}: {
  stockCounts: StockCountSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  emptyLabel: string;
  linkLabel: string;
}) {
  const tList = useTranslations("stocktake.list");

  if (isLoading) return <ListSkeleton cardsOnly cards={2} />;
  if (isError) {
    return <QueryErrorState message={tList("loadError")} onRetry={onRetry} />;
  }
  if (stockCounts.length === 0) {
    return (
      <Card className="border-border/70 bg-muted/20">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      {stockCounts.map((sc) => (
        <StockCountCard key={sc.id} stockCount={sc} linkLabel={linkLabel} />
      ))}
    </div>
  );
}

export function StockCountList() {
  const t = useTranslations("stocktake");
  const tList = useTranslations("stocktake.list");
  const [createOpen, setCreateOpen] = useState(false);

  const inProgress = useQuery({
    queryKey: stockCountKeys.list(false),
    queryFn: () => stockCountApi.list(false),
  });
  const completed = useQuery({
    queryKey: stockCountKeys.list(true),
    queryFn: () => stockCountApi.list(true),
  });

  const isFetching = inProgress.isFetching || completed.isFetching;
  const isLoading = inProgress.isLoading || completed.isLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <PlusIcon />
          {t("createButton")}
        </Button>
      </div>

      <QueryProgressBar active={isFetching && !isLoading} />

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {tList("inProgress")}
        </h2>
        <StockCountSection
          stockCounts={inProgress.data ?? []}
          isLoading={inProgress.isLoading}
          isError={inProgress.isError}
          onRetry={() => inProgress.refetch()}
          emptyLabel={tList("emptyInProgress")}
          linkLabel={tList("resume")}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          {tList("completed")}
        </h2>
        <StockCountSection
          stockCounts={completed.data ?? []}
          isLoading={completed.isLoading}
          isError={completed.isError}
          onRetry={() => completed.refetch()}
          emptyLabel={tList("emptyCompleted")}
          linkLabel={tList("view")}
        />
      </div>

      <CreateStockCountDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
