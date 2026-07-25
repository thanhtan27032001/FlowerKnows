"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ActionStatusBadge,
  ShippingStatusBadge,
} from "@/components/customers/customer-status-badges";
import { ListSkeleton } from "@/components/feedback/list-skeleton";
import { QueryErrorState } from "@/components/feedback/query-error-state";
import { QueryProgressBar } from "@/components/feedback/query-progress-bar";
import {
  ACTION_STATUS_LABEL,
  ACTION_STATUS_VALUES,
  customerApi,
  customerKeys,
  type CustomerActionStatus,
} from "@/src/lib/api/customer";
import { SHIPPING_LABEL, type ShippingStatus } from "@/src/lib/api/order";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SHIPPING_FILTER_VALUES: ShippingStatus[] = [
  "ORDER_CREATED",
  "SHIPPED",
  "COMPLETED",
];

type Props = {
  query: string;
  onQueryChange: (q: string) => void;
  actionStatus: CustomerActionStatus | "";
  onActionStatusChange: (value: CustomerActionStatus | "") => void;
  shippingStatus: ShippingStatus | "";
  onShippingStatusChange: (value: ShippingStatus | "") => void;
  onCreate: () => void;
};

export function CustomerSearchList({
  query,
  onQueryChange,
  actionStatus,
  onActionStatusChange,
  shippingStatus,
  onShippingStatusChange,
  onCreate,
}: Props) {
  const searchParams = {
    q: query,
    actionStatus,
    shippingStatus,
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: customerKeys.search(searchParams),
    queryFn: () => customerApi.search(searchParams),
  });

  const customers = data ?? [];
  const hasFilters = !!actionStatus || !!shippingStatus;

  return (
    <div className="relative space-y-4">
      <QueryProgressBar active={isFetching && !isLoading} />

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

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select
          value={actionStatus || "__all__"}
          onValueChange={(value) => {
            const next = String(value ?? "");
            onActionStatusChange(
              next === "__all__" ? "" : (next as CustomerActionStatus)
            );
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label="Filter by action status"
          >
            <SelectValue placeholder="Action status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All action statuses</SelectItem>
            {ACTION_STATUS_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {ACTION_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={shippingStatus || "__all__"}
          onValueChange={(value) => {
            const next = String(value ?? "");
            onShippingStatusChange(
              next === "__all__" ? "" : (next as ShippingStatus)
            );
          }}
        >
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label="Filter by shipping status"
          >
            <SelectValue placeholder="Shipping status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All shipping statuses</SelectItem>
            {SHIPPING_FILTER_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {SHIPPING_LABEL[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onActionStatusChange("");
              onShippingStatusChange("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={
            actionStatus === "NEEDS_IMMEDIATE_ORDER" ? "default" : "outline"
          }
          onClick={() =>
            onActionStatusChange(
              actionStatus === "NEEDS_IMMEDIATE_ORDER"
                ? ""
                : "NEEDS_IMMEDIATE_ORDER"
            )
          }
        >
          Needs Order Now
        </Button>
        <Button
          type="button"
          size="sm"
          variant={shippingStatus === "ORDER_CREATED" ? "default" : "outline"}
          onClick={() =>
            onShippingStatusChange(
              shippingStatus === "ORDER_CREATED" ? "" : "ORDER_CREATED"
            )
          }
        >
          Not yet shipped
        </Button>
      </div>

      {isLoading && <ListSkeleton columns={4} />}

      {isError && (
        <QueryErrorState
          message={
            error instanceof Error ? error.message : "Failed to load customers"
          }
          onRetry={() => refetch()}
        />
      )}

      {!isLoading && !isError && customers.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {query.trim() || hasFilters
              ? "No customers match your search/filters."
              : "No customers yet. Create one to get started."}
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && customers.length > 0 && (
        <>
          <div className="grid gap-3 md:hidden">
            {customers.map((customer) => (
              <Link key={customer.id} href={`/customers/${customer.id}`}>
                <Card className="transition-colors duration-200 hover:bg-muted/30 motion-reduce:transition-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base leading-snug">
                      {customer.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {customer.phone || "No phone"}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <ActionStatusBadge status={customer.actionStatus} />
                    <ShippingStatusBadge
                      status={customer.latestShippingStatus}
                    />
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
                  <TableHead>Action status</TableHead>
                  <TableHead>Shipping status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell>
                      <ActionStatusBadge status={customer.actionStatus} />
                    </TableCell>
                    <TableCell>
                      <ShippingStatusBadge
                        status={customer.latestShippingStatus}
                      />
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
