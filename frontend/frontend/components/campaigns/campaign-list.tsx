"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
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
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: campaignKeys.lists(),
    queryFn: campaignApi.list,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading campaigns…</p>;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load campaigns"}
        </p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const campaigns = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreate}>Create Campaign</Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No campaigns yet. Create your first campaign to start selling bags.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="grid gap-3 md:hidden">
            {campaigns.map((campaign) => (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {campaign.name}
                      </CardTitle>
                      <Badge
                        variant={campaign.status === "OPEN" ? "default" : "secondary"}
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

          {/* Desktop table */}
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
                        variant={campaign.status === "OPEN" ? "default" : "secondary"}
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
