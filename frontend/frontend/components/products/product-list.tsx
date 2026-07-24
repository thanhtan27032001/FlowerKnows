"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi, productKeys } from "@/src/lib/api/product";
import { formatCostPrice, vnd } from "@/src/lib/format";
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
  onStockIn: () => void;
};

export function ProductList({ onCreate, onStockIn }: Props) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading products…</p>;
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Failed to load products"}
        </p>
        <Button className="mt-3" variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const products = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onCreate}>Create Product</Button>
        <Button variant="outline" onClick={onStockIn} disabled={products.length === 0}>
          Stock In
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No products yet. Create your first product to manage inventory.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile card list */}
          <div className="grid gap-3 md:hidden">
            {products.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Card className="transition-colors hover:bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">
                        {product.name}
                      </CardTitle>
                      {product.lowStock && (
                        <Badge variant="destructive">Low stock</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">List price</p>
                      <p className="font-medium tabular-nums">
                        {vnd.format(product.listPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stock</p>
                      <p className="font-medium tabular-nums">
                        {product.stockQuantity}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Avg cost</p>
                      <p className="font-medium tabular-nums">
                        {formatCostPrice(product.averageCostPrice)}
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
                  <TableHead>List price</TableHead>
                  <TableHead>Avg cost</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/products/${product.id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {vnd.format(product.listPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCostPrice(product.averageCostPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {product.stockQuantity}
                    </TableCell>
                    <TableCell>
                      {product.lowStock ? (
                        <Badge variant="destructive">Low stock</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
