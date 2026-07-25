import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
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

export default async function DashboardLoading() {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");

  return (
    <AppShell title={t("title")}>
      <div
        className="space-y-6"
        aria-busy="true"
        aria-label={tCommon("a11y.loading")}
      >
        <section className="space-y-3">
          <Skeleton className="h-6 w-36" />
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-40" />
                  <Skeleton className="mt-2 h-3 w-48" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <section className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid gap-3 md:hidden">
            {Array.from({ length: 3 }, (_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-5 w-2/3" />
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="fk-table-surface hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  {Array.from({ length: 4 }, (_, i) => (
                    <TableHead key={i}>
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }, (_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-[9rem]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
