"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { customerApi, customerKeys } from "@/src/lib/api/customer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  onCreate: () => void;
};

export function CustomerSearchList({
  query,
  onQueryChange,
  onCreate,
}: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: customerKeys.search(query),
    queryFn: () => customerApi.search(query),
  });

  const customers = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search by name or phone"
          className="sm:max-w-sm"
          aria-label="Search customers"
        />
        <Button onClick={onCreate} className="sm:ml-auto">
          Create Customer
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading customers…</p>
      )}

      {isError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Failed to load customers"}
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && customers.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {query.trim()
              ? "No customers match your search."
              : "No customers yet. Create one to get started."}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && customers.length > 0 && (
        <>
          {isFetching && (
            <p className="text-xs text-muted-foreground">Updating…</p>
          )}

          <div className="grid gap-3 md:hidden">
            {customers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-snug">
                      {customer.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {customer.phone || "No phone"}
                    {customer.address ? ` · ${customer.address}` : ""}
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {customer.address || "—"}
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
