"use client";

import Link from "next/link";
import { use } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { StockCountDetail } from "@/components/stocktake/stock-count-detail";
import { stockCountApi, stockCountKeys } from "@/src/lib/api/stock-count";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function StockCountDetailSkeleton() {
  const tCommon = useTranslations("common.a11y");

  return (
    <div className="space-y-5" aria-busy="true" aria-label={tCommon("loading")}>
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export default function StockCountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations("stocktake");
  const tDetail = useTranslations("stocktake.detail");
  const tCommon = useTranslations("common");

  const { isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: stockCountKeys.detail(id),
    queryFn: () => stockCountApi.get(id),
  });

  return (
    <AppShell
      title={t("title")}
      actions={
        <Link
          href="/stocktake"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {tCommon("actions.back")}
        </Link>
      }
    >
      <div className="relative">
        <QueryProgressBar active={isFetching && !isLoading} />

        {isLoading && <StockCountDetailSkeleton />}

        {isError && (
          <QueryErrorState
            message={error instanceof Error ? error.message : tDetail("loadError")}
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && <StockCountDetail stockCountId={id} />}
      </div>
    </AppShell>
  );
}
