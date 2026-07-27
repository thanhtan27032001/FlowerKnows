"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CustomerToken } from "@/src/lib/api/customer";
import { formatCostPrice, formatDateTime, vnd } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  token: CustomerToken;
  selected: boolean;
  onToggle: () => void;
  /** Owner-only US-28 delete for CAMPAIGN holding tokens. */
  onDelete?: () => void;
};

export function HoldingTokenCard({
  token,
  selected,
  onToggle,
  onDelete,
}: Props) {
  const t = useTranslations("customers.tokenCard");
  const tStatus = useTranslations("common.status");
  const sourceLabel =
    token.sourceType === "EXCHANGE"
      ? tStatus("exchange.itemExchange")
      : token.sourceLabel;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="w-full text-left"
      >
        <Card
          className={cn(
            "fk-card-shadow fk-card-shadow-hover",
            selected && "ring-2 ring-primary/60 bg-primary/5",
            token.overdue && !selected && "border-amber-500/40 bg-amber-500/5"
          )}
        >
          <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent"
              )}
              aria-hidden
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 pr-14">
                <CardTitle className="text-base leading-snug">
                  {token.productName}
                </CardTitle>
                {token.overdue && (
                  <StatusBadge variant="danger" className="shrink-0">
                    {t("overdue")}
                  </StatusBadge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 pl-11 text-sm">
            <div>
              <p className="text-muted-foreground">{t("tokenValue")}</p>
              <p className="font-medium tabular-nums">
                {vnd.format(token.tokenValue)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("costBasis")}</p>
              <p className="font-medium tabular-nums">
                {formatCostPrice(token.costBasis)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("daysHeld")}</p>
              <p
                className={cn(
                  "font-medium tabular-nums",
                  token.overdue && "text-amber-800 dark:text-amber-200"
                )}
              >
                {token.daysHeld}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("source")}</p>
              <p className="font-medium leading-snug">{sourceLabel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">{t("issued")}</p>
              <p className="font-medium">{formatDateTime(token.createdAt)}</p>
            </div>
          </CardContent>
        </Card>
      </button>
      {onDelete && (
        <div className="absolute right-2 top-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            {t("delete")}
          </Button>
        </div>
      )}
    </div>
  );
}
