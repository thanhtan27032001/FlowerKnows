import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CustomerDetailLoading() {
  const t = await getTranslations("customers");
  const tA11y = await getTranslations("common.a11y");

  return (
    <AppShell title={t("detailFallbackTitle")}>
      <div className="space-y-6" aria-busy="true" aria-label={tA11y("loading")}>
        <Card>
          <CardHeader className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-8 w-40" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-36" />
          </CardContent>
        </Card>
        <Skeleton className="h-6 w-36" />
        <div className="grid gap-3">
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
      </div>
    </AppShell>
  );
}
