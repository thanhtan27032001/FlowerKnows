"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Props = {
  columns?: number;
  rows?: number;
  cards?: number;
  /** Show card skeletons at all breakpoints (no desktop table). */
  cardsOnly?: boolean;
};

/** Mobile cards (3) + desktop table rows (5) matching list layouts. */
export function ListSkeleton({
  columns = 5,
  rows = 5,
  cards = 3,
  cardsOnly = false,
}: Props) {
  const t = useTranslations("common.a11y");

  const cardGrid = (
    <div className={cn("grid gap-3", !cardsOnly && "md:hidden")}>
      {Array.from({ length: cards }, (_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="col-span-2 h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-3" aria-busy="true" aria-label={t("loading")}>
      {cardGrid}

      {!cardsOnly && (
        <div className="fk-table-surface hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: columns }, (_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: columns }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-[9rem]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
