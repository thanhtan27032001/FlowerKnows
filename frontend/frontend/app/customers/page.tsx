"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CreateCustomerForm } from "@/components/customers/create-customer-form";
import { CustomerSearchList } from "@/components/customers/customer-search-list";
import type { CustomerActionStatus } from "@/src/lib/api/customer";
import type { ShippingStatus } from "@/src/lib/api/order";

export default function CustomersPage() {
  const t = useTranslations("customers");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [actionStatus, setActionStatus] = useState<CustomerActionStatus | "">(
    ""
  );
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus | "">("");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell title={t("title")}>
      <CustomerSearchList
        query={query}
        onQueryChange={setQuery}
        actionStatus={actionStatus}
        onActionStatusChange={setActionStatus}
        shippingStatus={shippingStatus}
        onShippingStatusChange={setShippingStatus}
        onCreate={() => setCreateOpen(true)}
      />
      <CreateCustomerForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/customers/${id}`)}
      />
    </AppShell>
  );
}
