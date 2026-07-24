"use client";

import type { CustomerToken, TokenStatus } from "@/src/lib/api/customer";
import { formatDateTime, vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_LABEL: Record<Exclude<TokenStatus, "HOLDING">, string> = {
  EXCHANGED: "Exchanged",
  CASHED_OUT: "Cashed out",
  ORDERED: "Ordered",
  CANCELLED: "Cancelled",
};

type Props = {
  token: CustomerToken;
};

export function HistoryTokenCard({ token }: Props) {
  const statusLabel =
    token.status === "HOLDING"
      ? "Holding"
      : STATUS_LABEL[token.status as Exclude<TokenStatus, "HOLDING">];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base leading-snug">
          {token.productName}
        </CardTitle>
        <Badge variant="secondary">{statusLabel}</Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Token value</p>
          <p className="font-medium tabular-nums">
            {vnd.format(token.tokenValue)}
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
  );
}
