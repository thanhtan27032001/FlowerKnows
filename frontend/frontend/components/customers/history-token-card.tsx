"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { CustomerToken } from "@/src/lib/api/customer";
import { formatDateTime, vnd } from "@/src/lib/format";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  token: CustomerToken;
  highlighted?: boolean;
};

export function HistoryTokenCard({ token, highlighted = false }: Props) {
  const t = useTranslations("customers.tokenCard");
  const tStatus = useTranslations("common.status");
  const sourceLabel =
    token.sourceType === "EXCHANGE"
      ? tStatus("exchange.itemExchange")
      : token.sourceLabel;

  return (
    <Card className={cn(highlighted && "fk-token-flash")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base leading-snug">
          {token.productName}
        </CardTitle>
        <StatusBadge type="token" status={token.status} />
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">{t("tokenValue")}</p>
          <p className="font-medium tabular-nums">
            {vnd.format(token.tokenValue)}
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
  );
}
