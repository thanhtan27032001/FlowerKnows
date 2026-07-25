"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { reportApi, reportKeys } from "@/src/lib/api/report";
import { tokenApi, tokenKeys } from "@/src/lib/api/token";
import { vndCost } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function ProfitSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" aria-busy="true" aria-label={loadingLabel}>
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="mt-2 h-3 w-48" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InventorySkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label={loadingLabel}>
      <div className="grid gap-3 md:hidden">
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
      <div className="fk-table-surface hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 4 }, (_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 4 }, (_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full max-w-[9rem]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tCommon = useTranslations("common");

  const profitQuery = useQuery({
    queryKey: reportKeys.profitOverview(),
    queryFn: reportApi.profitOverview,
  });

  const inventoryQuery = useQuery({
    queryKey: reportKeys.inventory(),
    queryFn: reportApi.inventory,
  });

  const overdueQuery = useQuery({
    queryKey: tokenKeys.overdue(),
    queryFn: tokenApi.listOverdue,
  });

  const profit = profitQuery.data;
  const inventory = inventoryQuery.data ?? [];
  const lowStock = inventory.filter((i) => i.lowStock);
  const overdueCount = overdueQuery.data?.length ?? 0;
  const lockedTotal = inventory.reduce(
    (sum, i) => sum + i.lockedInOpenCampaigns,
    0
  );
  const stockTotal = inventory.reduce((sum, i) => sum + i.stockQuantity, 0);

  const isBackgroundFetching =
    (profitQuery.isFetching && !profitQuery.isLoading) ||
    (inventoryQuery.isFetching && !inventoryQuery.isLoading) ||
    (overdueQuery.isFetching && !overdueQuery.isLoading);

  const loadingLabel = tCommon("a11y.loading");

  return (
    <AppShell title={t("title")}>
      <div className="relative space-y-6">
        <QueryProgressBar active={isBackgroundFetching} />

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              {t("profit.title")}
            </h2>
            <Link
              href="/reports"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              {t("profit.linkGrossMargin")}
            </Link>
          </div>

          {profitQuery.isLoading && <ProfitSkeleton loadingLabel={loadingLabel} />}

          {profitQuery.isError && (
            <QueryErrorState
              message={
                profitQuery.error instanceof Error
                  ? profitQuery.error.message
                  : t("profit.loadError")
              }
              onRetry={() => profitQuery.refetch()}
            />
          )}

          {profit && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="fk-card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("profit.totalCapital")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {vndCost.format(profit.totalCapitalInvested)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="fk-card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("profit.totalRevenue")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {vndCost.format(profit.totalRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("profit.revenueBreakdown", {
                        orders: vndCost.format(profit.revenueFromOrders),
                        cancelled: vndCost.format(
                          profit.revenueFromCancelledTokens
                        ),
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card className="fk-card-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("profit.totalProfit")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={`text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${
                        profit.totalProfit < 0
                          ? "text-amber-800 dark:text-amber-200"
                          : ""
                      }`}
                    >
                      {vndCost.format(profit.totalProfit)}
                    </p>
                    {profit.totalProfit < 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("profit.negativeHint")}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {t("profit.cashBasisNote")}
              </p>
            </>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="fk-card-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.availableStock")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inventoryQuery.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {stockTotal}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="fk-card-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.lockedInCampaigns")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inventoryQuery.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {lockedTotal}
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="fk-card-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("stats.overdueTokens")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-2">
              {overdueQuery.isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <p className="text-3xl font-semibold tabular-nums tracking-tight">
                  {overdueCount}
                </p>
              )}
              {overdueCount > 0 && (
                <Link
                  href="/alerts"
                  className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  {t("stats.viewAlerts")}
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {overdueQuery.isError && (
          <QueryErrorState
            message={
              overdueQuery.error instanceof Error
                ? overdueQuery.error.message
                : t("overdue.loadError")
            }
            onRetry={() => overdueQuery.refetch()}
          />
        )}

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              {t("inventory.title")}
            </h2>
            <Link
              href="/reports"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              {t("inventory.linkRevenue")}
            </Link>
          </div>

          {inventoryQuery.isLoading && (
            <InventorySkeleton loadingLabel={loadingLabel} />
          )}

          {inventoryQuery.isError && (
            <QueryErrorState
              message={
                inventoryQuery.error instanceof Error
                  ? inventoryQuery.error.message
                  : t("inventory.loadError")
              }
              onRetry={() => inventoryQuery.refetch()}
            />
          )}

          {!inventoryQuery.isLoading &&
            !inventoryQuery.isError &&
            inventory.length === 0 && (
              <Card className="border-border/70 bg-muted/20">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {t("inventory.empty")}
                </CardContent>
              </Card>
            )}

          {inventory.length > 0 && (
            <>
              {lowStock.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                  {t("inventory.lowStockBanner", { count: lowStock.length })}
                </div>
              )}

              <div className="grid gap-3 md:hidden">
                {inventory.map((item) => (
                  <Card key={item.productId}>
                    <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-base leading-snug">
                        <Link
                          href={`/products/${item.productId}`}
                          className="hover:underline"
                        >
                          {item.productName}
                        </Link>
                      </CardTitle>
                      {item.lowStock && <StatusBadge type="lowStock" />}
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">
                          {t("inventory.stock")}
                        </p>
                        <p className="font-medium tabular-nums">
                          {item.stockQuantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">
                          {t("inventory.locked")}
                        </p>
                        <p className="font-medium tabular-nums">
                          {item.lockedInOpenCampaigns}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="fk-table-surface hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("inventory.columns.product")}</TableHead>
                      <TableHead>{t("inventory.columns.stock")}</TableHead>
                      <TableHead>{t("inventory.columns.locked")}</TableHead>
                      <TableHead>{t("inventory.columns.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory.map((item) => (
                      <TableRow key={item.productId}>
                        <TableCell>
                          <Link
                            href={`/products/${item.productId}`}
                            className="font-medium hover:underline"
                          >
                            {item.productName}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {item.stockQuantity}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {item.lockedInOpenCampaigns}
                        </TableCell>
                        <TableCell>
                          {item.lowStock ? (
                            <StatusBadge type="lowStock" />
                          ) : (
                            <span className="text-muted-foreground">
                              {tCommon("fallback.emDash")}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
