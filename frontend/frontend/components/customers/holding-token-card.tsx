"use client";

import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const sourceLabel =
    token.sourceType === "EXCHANGE"
      ? tStatus("exchange.itemExchange")
      : token.sourceLabel;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        aria-expanded={expanded}
        className="w-full text-left"
      >
        <Card
          className={cn(
            "fk-card-shadow fk-card-shadow-hover",
            selected && "ring-2 ring-primary/60 bg-primary/5",
            token.overdue && !selected && "border-amber-500/40 bg-amber-500/5"
          )}
        >
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-1">
            <button
              type="button"
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded border text-xs transition-[background-color,border-color,color] duration-200 motion-reduce:transition-none",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent"
              )}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
              aria-pressed={selected}
              aria-label={selected ? "Unselect token" : "Select token"}
            >
              ✓
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">
                  {token.productName}
                </CardTitle>
                {token.overdue && (
                  <StatusBadge variant="danger" className="shrink-0">
                    {t("overdue")}
                  </StatusBadge>
                )}
              </div>
              <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">
                {sourceLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {onDelete && (
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
              )}
            </div>
          </CardHeader>
          <CardContent className={cn("pl-11 pt-0", !expanded && "hidden")}>
            <div
              className="space-y-2 border-t border-border/60 pt-2 text-sm"
            >
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
                <p className="text-muted-foreground">{t("issued")}</p>
                <p className="font-medium">{formatDateTime(token.createdAt)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
