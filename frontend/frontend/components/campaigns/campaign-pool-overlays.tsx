"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CreateProductForm } from "@/components/products/create-product-form";
import { StockInForm } from "@/components/products/stock-in-form";
import { Button } from "@/components/ui/button";

/**
 * Shared Create Product / Stock In overlays for Campaign pool builders
 * (US-01 AC#8/#9, US-24 AC#5) — same stacked-dialog pattern as Stock In v4.1.
 */
export function useCampaignPoolOverlays() {
  const tList = useTranslations("products.list");
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [stockInOpen, setStockInOpen] = useState(false);

  const closeOverlays = () => {
    setCreateProductOpen(false);
    setStockInOpen(false);
  };

  const overlayButtons = (disabled = false): ReactNode => (
    <div className="flex w-full flex-col-reverse gap-2 sm:mr-auto sm:w-auto sm:flex-row">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setCreateProductOpen(true)}
      >
        {tList("createButton")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setStockInOpen(true)}
      >
        {tList("stockInButton")}
      </Button>
    </div>
  );

  const overlays = (
    <>
      <CreateProductForm
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
      />
      <StockInForm open={stockInOpen} onOpenChange={setStockInOpen} />
    </>
  );

  return { overlayButtons, overlays, closeOverlays };
}
