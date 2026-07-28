"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CustomerToken } from "@/src/lib/api/customer";
import { formatDateTime, vnd } from "@/src/lib/format";
import { ExchangedTokenLabel } from "@/components/shared/exchanged-token-label";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  token: CustomerToken;
  highlighted?: boolean;
};

export function HistoryTokenCard({ token, highlighted = false }: Props) {
  const t = useTranslations("customers.tokenCard");
  const tStatus = useTranslations("common.status");
  const [expanded, setExpanded] = useState(false);
  const sourceLabel =
    token.sourceType === "EXCHANGE"
      ? tStatus("exchange.itemExchange")
      : token.sourceLabel;

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setExpanded((prev) => !prev);
        }
      }}
      className={cn("fk-card-shadow", highlighted && "fk-token-flash")}
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-1">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-base leading-snug">
            {token.status === "EXCHANGED" ? (
              <ExchangedTokenLabel
                productName={token.productName}
                exchangedIntoProductNames={token.exchangedIntoProductNames}
              />
            ) : (
              token.productName
            )}
          </CardTitle>
          <p className="mt-1 text-sm font-medium leading-snug text-muted-foreground">
            {sourceLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge type="token" status={token.status} />
        </div>
      </CardHeader>
      <CardContent className={cn("pt-0", !expanded && "hidden")}>
        <div className="space-y-2 border-t border-border/60 pt-2 text-sm">
        <div>
          <p className="text-muted-foreground">{t("tokenValue")}</p>
          <p className="font-medium tabular-nums">
            {vnd.format(token.tokenValue)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t("issued")}</p>
          <p className="font-medium">{formatDateTime(token.createdAt)}</p>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
