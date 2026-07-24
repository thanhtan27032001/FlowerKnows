"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OrderList } from "@/components/orders/order-list";

function OrdersContent() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  return <OrderList highlightId={highlight} />;
}

export default function OrdersPage() {
  return (
    <AppShell title="Orders">
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading orders…</p>
        }
      >
        <OrdersContent />
      </Suspense>
    </AppShell>
  );
}
