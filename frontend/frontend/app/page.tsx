"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/app-shell";
import { reportApi, reportKeys } from "@/src/lib/api/report";
import { tokenApi, tokenKeys } from "@/src/lib/api/token";
import { vndCost } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DashboardPage() {
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

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              Profit overview
            </h2>
            <Link
              href="/reports"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Gross Margin Report
            </Link>
          </div>

          {profitQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading profit overview…</p>
          )}

          {profitQuery.isError && (
            <p className="text-sm text-destructive">
              {profitQuery.error instanceof Error
                ? profitQuery.error.message
                : "Failed to load profit overview"}
            </p>
          )}

          {profit && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Capital Invested
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {vndCost.format(profit.totalCapitalInvested)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
                      {vndCost.format(profit.totalRevenue)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Orders {vndCost.format(profit.revenueFromOrders)} · Cancelled{" "}
                      {vndCost.format(profit.revenueFromCancelledTokens)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Profit
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
                        Negative is expected early on when stock-in exceeds sales
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                {profit.note}
              </p>
            </>
          )}
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Available stock units
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {inventoryQuery.isLoading ? "…" : stockTotal}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Locked in open campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {inventoryQuery.isLoading ? "…" : lockedTotal}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Overdue tokens
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between gap-2">
              <p className="text-3xl font-semibold tabular-nums tracking-tight">
                {overdueQuery.isLoading ? "…" : overdueCount}
              </p>
              {overdueCount > 0 && (
                <Link
                  href="/alerts"
                  className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                >
                  View alerts
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
              Inventory overview
            </h2>
            <Link
              href="/reports"
              className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
            >
              Revenue report
            </Link>
          </div>

          {inventoryQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading inventory…</p>
          )}

          {inventoryQuery.isError && (
            <p className="text-sm text-destructive">
              {inventoryQuery.error instanceof Error
                ? inventoryQuery.error.message
                : "Failed to load inventory"}
            </p>
          )}

          {!inventoryQuery.isLoading &&
            !inventoryQuery.isError &&
            inventory.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No products yet.
                </CardContent>
              </Card>
            )}

          {inventory.length > 0 && (
            <>
              {lowStock.length > 0 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                  {lowStock.length} product
                  {lowStock.length === 1 ? "" : "s"} flagged as low stock.
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
                      {item.lowStock && (
                        <Badge variant="destructive">Low stock</Badge>
                      )}
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Stock</p>
                        <p className="font-medium tabular-nums">
                          {item.stockQuantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Locked</p>
                        <p className="font-medium tabular-nums">
                          {item.lockedInOpenCampaigns}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Locked in campaigns</TableHead>
                      <TableHead>Status</TableHead>
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
                            <Badge variant="destructive">Low stock</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
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
