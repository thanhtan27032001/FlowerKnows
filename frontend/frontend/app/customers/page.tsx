"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { CreateCustomerForm } from "@/components/customers/create-customer-form";
import { CustomerSearchList } from "@/components/customers/customer-search-list";

export default function CustomersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <AppShell title="Customers">
      <CustomerSearchList
        query={query}
        onQueryChange={setQuery}
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
