"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import { campaignApi, campaignKeys } from "@/src/lib/api/campaign";
import { formatDate, vnd } from "@/src/lib/format";
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

type Props = {
  onCreate: () => void;
};

export function CampaignList({ onCreate }: Props) {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: campaignKeys.lists(),
    queryFn: campaignApi.list,
  });

  const campaigns = data ?? [];

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreate}>Create Campaign</Button>
      </div>

      {isLoading && <ListSkeleton columns={5} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : "Failed to load campaigns"
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && campaigns.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No campaigns yet. Create your first campaign to start selling bags.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && campaigns.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="transition-colors duration-200 hover:bg-muted/30 motion-reduce:transition-none">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {campaign.name}
                      </CardTitle>
                      <Badge
                        variant={
                          campaign.status === "OPEN" ? "default" : "secondary"
                        }
                      >
                        {campaign.status === "OPEN" ? "Open" : "Closed"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Event date</p>
                      <p className="font-medium">{formatDate(campaign.eventDate)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bag price</p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(campaign.bagPrice)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Bags sold</p>
                      <p className="font-medium tabular-nums">
                        {campaign.bagsSold} / {campaign.totalBags}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-border/80 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Event date</TableHead>
                  <TableHead>Bag price</TableHead>
                  <TableHead>Bags sold</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="font-medium hover:underline"
                      >
                        {campaign.name}
                      </Link>
                    </TableCell>
                    <TableCell>{formatDate(campaign.eventDate)}</TableCell>
                    <TableCell className="tabular-nums">
                      {vnd.format(campaign.bagPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {campaign.bagsSold} / {campaign.totalBags}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          campaign.status === "OPEN" ? "default" : "secondary"
                        }
                      >
                        {campaign.status === "OPEN" ? "Open" : "Closed"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
