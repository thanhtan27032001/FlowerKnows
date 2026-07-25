"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { tokenApi, tokenKeys, type OverdueToken } from "@/src/lib/api/token";
import { formatDateTime, vnd } from "@/src/lib/format";
import { CancelTokenDialog } from "@/components/tokens/cancel-token-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function OverdueTokenList() {
  const [cancelTarget, setCancelTarget] = useState<OverdueToken | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: tokenKeys.overdue(),
    queryFn: tokenApi.listOverdue,
  });

  const tokens = data ?? [];

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      {isLoading && <ListSkeleton columns={6} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error
              ? error.message
              : "Failed to load overdue tokens"
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && tokens.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tokens held over 30 days. Nice work.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && tokens.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {tokens.map((token) => (
              <Card key={token.id} className="border-amber-500/30 bg-amber-500/5">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {token.productName}
                    </CardTitle>
                    <Badge variant="destructive">{token.daysHeld} days</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <Link
                        href={`/customers/${token.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {token.customerName}
                      </Link>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(token.tokenValue)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Issued</p>
                      <p className="font-medium">
                        {formatDateTime(token.createdAt)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setCancelTarget(token)}
                  >
                    Cancel Token
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Days held</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${token.customerId}`}
                        className="font-medium hover:underline"
                      >
                        {token.customerName}
                      </Link>
                      {token.customerPhone && (
                        <p className="text-xs text-muted-foreground">
                          {token.customerPhone}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{token.productName}</TableCell>
                    <TableCell>{formatDateTime(token.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{token.daysHeld}</Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vnd.format(token.tokenValue)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setCancelTarget(token)}
                      >
                        Cancel Token
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {cancelTarget && (
        <CancelTokenDialog
          open={!!cancelTarget}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          tokenId={cancelTarget.id}
          tokenValue={cancelTarget.tokenValue}
          productName={cancelTarget.productName}
          customerId={cancelTarget.customerId}
        />
      )}
    </div>
  );
}
