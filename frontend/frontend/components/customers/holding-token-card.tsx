"use client";

import { cn } from "@/lib/utils";
import type { CustomerToken } from "@/src/lib/api/customer";
import { formatCostPrice, formatDateTime, vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  token: CustomerToken;
  selected: boolean;
  onToggle: () => void;
};

export function HoldingTokenCard({ token, selected, onToggle }: Props) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="w-full text-left"
    >
      <Card
        className={cn(
          "transition-[box-shadow,background-color,opacity] duration-200 motion-reduce:transition-none",
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
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">
                {token.productName}
              </CardTitle>
              {token.overdue && (
                <Badge variant="destructive" className="shrink-0">
                  Overdue (30+ days)
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 pl-11 text-sm">
          <div>
            <p className="text-muted-foreground">Token value</p>
            <p className="font-medium tabular-nums">
              {vnd.format(token.tokenValue)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Cost basis</p>
            <p className="font-medium tabular-nums">
              {formatCostPrice(token.costBasis)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Days held</p>
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
            <p className="text-muted-foreground">Source</p>
            <p className="font-medium leading-snug">{token.sourceLabel}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Issued</p>
            <p className="font-medium">{formatDateTime(token.createdAt)}</p>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}
