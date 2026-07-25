import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <AppShell title="Revenue Report">
      <div className="space-y-6" aria-busy="true" aria-label="Loading">
        <Card>
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
