"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/layout/app-shell";
import { ProductList } from "@/components/products/product-list";
import { CreateProductForm } from "@/components/products/create-product-form";
import { StockInForm } from "@/components/products/stock-in-form";

export default function ProductsPage() {
  const t = useTranslations("products");
  const [createOpen, setCreateOpen] = useState(false);
  const [stockInOpen, setStockInOpen] = useState(false);

  return (
    <AppShell title={t("title")}>
      <ProductList
        onCreate={() => setCreateOpen(true)}
        onStockIn={() => setStockInOpen(true)}
      />
      <CreateProductForm open={createOpen} onOpenChange={setCreateOpen} />
      <StockInForm open={stockInOpen} onOpenChange={setStockInOpen} />
    </AppShell>
  );
}
