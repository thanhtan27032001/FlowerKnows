import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default async function CampaignDetailLoading() {
  const t = await getTranslations("campaigns");
  const tA11y = await getTranslations("common.a11y");

  return (
    <AppShell title={t("detailFallbackTitle")}>
      <div className="space-y-5" aria-busy="true" aria-label={tA11y("loading")}>
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
    </AppShell>
  );
}
