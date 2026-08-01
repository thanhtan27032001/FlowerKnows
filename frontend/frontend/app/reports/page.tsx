"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { campaignApi, campaignKeys } from "@/src/lib/api/campaign";
import { reportApi, reportKeys } from "@/src/lib/api/report";
import { vnd, vndCost } from "@/src/lib/format";
import { tokenStatusLabel } from "@/src/lib/i18n-labels";
import {
  StatusBadge,
  tokenStatusVariant,
} from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to), campaignId: "" };
}

function ReportSkeleton({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={loadingLabel}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-36" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const t = useTranslations("reports");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("common.status");

  const initial = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [campaignId, setCampaignId] = useState("");
  const [applied, setApplied] = useState(initial);

  const campaignsQuery = useQuery({
    queryKey: campaignKeys.lists(),
    queryFn: campaignApi.list,
  });

  const revenueQuery = useQuery({
    queryKey: reportKeys.revenue(
      applied.from,
      applied.to,
      applied.campaignId || undefined
    ),
    queryFn: () =>
      reportApi.revenue(
        applied.from,
        applied.to,
        applied.campaignId || undefined
      ),
  });

  const report = revenueQuery.data;
  const reconciliation = report?.reconciliation;
  const loadingLabel = tCommon("a11y.loading");

  return (
    <AppShell title={t("title")}>
      <div className="relative space-y-6">
        <QueryProgressBar
          active={revenueQuery.isFetching && !revenueQuery.isLoading}
        />

        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="from">{t("filters.from")}</Label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">{t("filters.to")}</Label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t("filters.campaignOptional")}</Label>
              <Select
                value={campaignId || "__all__"}
                onValueChange={(value) => {
                  const next = String(value ?? "");
                  setCampaignId(next === "__all__" ? "" : next);
                }}
              >
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder={t("filters.allCampaigns")}>
                    {campaignId
                      ? (campaignsQuery.data ?? []).find((c) => c.id === campaignId)
                          ?.name ?? campaignId
                      : t("filters.allCampaigns")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">
                    {t("filters.allCampaigns")}
                  </SelectItem>
                  {(campaignsQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() =>
                  setApplied({
                    from,
                    to,
                    campaignId,
                  })
                }
              >
                {t("filters.apply")}
              </Button>
            </div>
          </CardContent>
        </Card>

        {revenueQuery.isLoading && (
          <ReportSkeleton loadingLabel={loadingLabel} />
        )}

        {revenueQuery.isError && (
          <QueryErrorState
            message={
              revenueQuery.error instanceof Error
                ? revenueQuery.error.message
                : t("loadError")
            }
            onRetry={() => revenueQuery.refetch()}
          />
        )}

        {report && reconciliation && (
          <>
            {!reconciliation.balanced && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <p className="font-medium">{t("reconciliationWarning.title")}</p>
                <p className="mt-1">{t("reconciliationWarning.body")}</p>
                <p className="mt-1 text-xs opacity-90">
                  {t("reconciliation.formula")}
                </p>
              </div>
            )}

            {report.marginMayBeUnderstated && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">{t("missingCost.title")}</p>
                <p className="mt-1">
                  {t("missingCost.body", {
                    count: report.ordersWithMissingCostBasis,
                  })}
                </p>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("kpis.revenueFromOrders")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {vnd.format(report.revenueFromOrders)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("kpis.cancelledTokenRevenue")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {vnd.format(report.revenueFromCancelledTokens)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("kpis.directSaleRevenue")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {vnd.format(report.revenueFromDirectSales)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("kpis.totalRevenue")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {vnd.format(report.totalRevenue)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("kpis.totalRefunded")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">
                    {vnd.format(report.totalRefundedCashOut)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("margin.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("margin.orderGrossMargin")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {vndCost.format(report.orderGrossMargin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("margin.cancelledTokenMargin")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {vndCost.format(report.cancelledTokenMargin)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("margin.fullMargin")}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("margin.directSaleGrossMargin")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {vndCost.format(report.directSaleGrossMargin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("margin.totalGrossMargin")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {vndCost.format(report.totalGrossMargin)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {t("margin.grossMarginPct")}
                    </p>
                    <p className="text-xl font-semibold tabular-nums">
                      {report.grossMarginPercent.toLocaleString("vi-VN", {
                        maximumFractionDigits: 2,
                      })}
                      %
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{t("reconciliation.title")}</CardTitle>
                  <Badge
                    variant={
                      reconciliation.balanced ? "secondary" : "destructive"
                    }
                  >
                    {reconciliation.balanced
                      ? t("reconciliation.balanced")
                      : t("reconciliation.outOfBalance")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("reconciliation.totalPrepaid")}
                  </span>
                  <span className="tabular-nums">
                    {vnd.format(reconciliation.totalPrepaid)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("reconciliation.holdingTokens")}
                  </span>
                  <span className="tabular-nums">
                    {vnd.format(reconciliation.holdingTokensValue)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("reconciliation.recognizedRevenue")}
                  </span>
                  <span className="tabular-nums">
                    {vnd.format(reconciliation.recognizedRevenue)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    {t("reconciliation.totalRefunded")}
                  </span>
                  <span className="tabular-nums">
                    {vnd.format(reconciliation.totalRefunded)}
                  </span>
                </div>
                <p className="pt-2 text-xs text-muted-foreground">
                  {t("reconciliation.formula")}
                </p>
              </CardContent>
            </Card>

            {report.campaignBreakdown && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {t("campaignBreakdown.campaign", {
                      name: report.campaignBreakdown.campaignName,
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-muted-foreground">
                        {t("campaignBreakdown.prepaid")}
                      </p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(report.campaignBreakdown.prepaidAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {t("campaignBreakdown.bagsSold")}
                      </p>
                      <p className="font-medium tabular-nums">
                        {report.campaignBreakdown.bagsSold} /{" "}
                        {report.campaignBreakdown.totalBags}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-muted-foreground">
                      {t("campaignBreakdown.tokensByStatus")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(
                        report.campaignBreakdown.tokensByStatus
                      ).map(([status, count]) => (
                        <StatusBadge
                          key={status}
                          variant={tokenStatusVariant(status)}
                        >
                          {tokenStatusLabel(tStatus, status)}: {count}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
