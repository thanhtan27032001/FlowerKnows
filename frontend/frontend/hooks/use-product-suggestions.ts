"use client";

import { useMemo } from "react";
import type { Product } from "@/src/lib/api/product";
import { containsFolded, foldText } from "@/src/lib/text-search";

export const PRODUCT_SUGGESTION_LIMIT = 20;

/** Accent-insensitive name filter shared by the product search inputs. */
export function useProductSuggestions(
  products: Product[],
  query: string,
  limit = PRODUCT_SUGGESTION_LIMIT
) {
  return useMemo(() => {
    const needle = foldText(query);
    return products.filter((p) => containsFolded(p.name, needle)).slice(0, limit);
  }, [products, query, limit]);
}
