"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "lucide-react";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { AppShell } from "@/components/layout/app-shell";
import { CloseCampaignDialog } from "@/components/campaigns/close-campaign-dialog";
import { ParticipantItemsPanel } from "@/components/campaigns/participant-items-panel";
import { RecordItemForm } from "@/components/campaigns/record-item-form";
import { RecordParticipantForm } from "@/components/campaigns/record-participant-form";
import { campaignApi, campaignKeys } from "@/src/lib/api/campaign";
import { formatDate, formatDateTime, vnd } from "@/src/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function CampaignDetailSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [closeOpen, setCloseOpen] = useState(false);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [itemOpen, setItemOpen] = useState(false);
  const [itemCustomerId, setItemCustomerId] = useState("");

  const {
    data: campaign,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: () => campaignApi.get(id),
  });

  const openRecordItem = (customerId = "") => {
    setItemCustomerId(customerId);
    setItemOpen(true);
  };

  return (
    <AppShell
      title={campaign?.name ?? "Campaign"}
      actions={
        <Link
          href="/campaigns"
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Link>
      }
    >
      <div className="relative">
        <QueryProgressBar active={isFetching && !isLoading} />

        {isLoading && <CampaignDetailSkeleton />}

        {isError && (
          <QueryErrorState
            message={
              error instanceof Error ? error.message : "Failed to load campaign"
            }
            onRetry={() => refetch()}
          />
        )}

        {campaign && (
          <div className="space-y-5">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div>
                  <CardTitle className="text-xl">{campaign.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Created {formatDateTime(campaign.createdAt)}
                  </p>
                </div>
                <Badge
                  variant={campaign.status === "OPEN" ? "default" : "secondary"}
                >
                  {campaign.status === "OPEN" ? "Open" : "Closed"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Event date</p>
                    <p className="font-medium">{formatDate(campaign.eventDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bag price</p>
                    <p className="font-medium tabular-nums">
                      {vnd.format(campaign.bagPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bags sold</p>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {campaign.bagsSold}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {campaign.totalBags}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Remaining bags</p>
                    <p className="font-medium tabular-nums">
                      {campaign.totalBags - campaign.bagsSold}
                    </p>
                  </div>
                </div>

                {campaign.status === "OPEN" && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setParticipantOpen(true)}>
                      Record Participant
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openRecordItem()}
                      disabled={campaign.participants.length === 0}
                    >
                      Record Item
                    </Button>
                    <Button variant="outline" onClick={() => setCloseOpen(true)}>
                      Close Campaign
                    </Button>
                  </div>
                )}

                {campaign.status === "CLOSED" && (
                  <p className="text-sm text-muted-foreground">
                    This campaign is closed, no further entries allowed.
                  </p>
                )}
              </CardContent>
            </Card>

            <section className="space-y-3">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                Product pool
              </h2>

              {campaign.pool.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No products in this campaign pool.
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-3 md:hidden">
                    {campaign.pool.map((item) => (
                      <Card key={item.id}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base leading-snug">
                            {item.productName}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-muted-foreground">Loaded</p>
                            <p className="font-medium tabular-nums">
                              {item.loadedQuantity}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Remaining</p>
                            <p className="font-medium tabular-nums">
                              {item.remainingQuantity}
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
                          <TableHead>Loaded</TableHead>
                          <TableHead>Remaining</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {campaign.pool.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.productName}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {item.loadedQuantity}
                            </TableCell>
                            <TableCell className="tabular-nums">
                              {item.remainingQuantity}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight">
                  Participants
                </h2>
                {campaign.status === "OPEN" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setParticipantOpen(true)}
                  >
                    Record Participant
                  </Button>
                )}
              </div>

              {campaign.participants.length === 0 ? (
                <Card className="border-border/70 bg-muted/20">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No participants recorded yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {campaign.participants.map((p) => (
                    <ParticipantItemsPanel
                      key={p.id}
                      campaignId={campaign.id}
                      participant={p}
                      canRecordItem={campaign.status === "OPEN"}
                      onRecordItem={() => openRecordItem(p.customerId)}
                    />
                  ))}
                </div>
              )}
            </section>

            <CloseCampaignDialog
              campaignId={campaign.id}
              open={closeOpen}
              onOpenChange={setCloseOpen}
              onClosed={() => void refetch()}
            />
            <RecordParticipantForm
              open={participantOpen}
              onOpenChange={setParticipantOpen}
              campaign={campaign}
            />
            <RecordItemForm
              key={itemOpen ? `item-${itemCustomerId || "any"}` : "item-closed"}
              open={itemOpen}
              onOpenChange={setItemOpen}
              campaign={campaign}
              defaultCustomerId={itemCustomerId}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
