"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { OrderList } from "@/components/orders/order-list";

function OrdersContent() {
  const searchParams = useSearchParams();
  const highlight = searchParams.get("highlight");

  return <OrderList highlightId={highlight} />;
}

export default function OrdersPage() {
  const t = useTranslations("orders");

  return (
    <AppShell title={t("title")}>
      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        }
      >
        <OrdersContent />
      </Suspense>
    </AppShell>
  );
}
