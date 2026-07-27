"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import type { Product } from "@/src/lib/api/product";
import { containsFolded, foldText } from "@/src/lib/text-search";
import { Input } from "@/components/ui/input";

const SUGGESTION_LIMIT = 20;

type Props = {
  id?: string;
  products: Product[];
  productId: string;
  onSelect: (product: Product | null) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-invalid"?: boolean;
};

export function ProductTypeahead({
  id,
  products,
  productId,
  onSelect,
  placeholder,
  disabled,
  autoFocus,
  "aria-invalid": ariaInvalid,
}: Props) {
  const t = useTranslations("products.stockIn");
  const selected = products.find((p) => p.id === productId) ?? null;
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = `${id ?? "product"}-suggestions`;

  useEffect(() => {
    if (selected) {
      setQuery(selected.name);
    }
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
        if (selected) setQuery(selected.name);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, selected]);

  const suggestions = useMemo(() => {
    const needle = foldText(query);
    return products
      .filter((p) => containsFolded(p.name, needle))
      .slice(0, SUGGESTION_LIMIT);
  }, [products, query]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query, open]);

  const pick = (product: Product) => {
    setQuery(product.name);
    setOpen(false);
    onSelect(product);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      if (selected) setQuery(selected.name);
      return;
    }
    if (event.key === "Enter" && open) {
      const choice = suggestions[highlightIndex] ?? suggestions[0];
      if (choice) {
        event.preventDefault();
        pick(choice);
      }
      return;
    }
    if (event.key === "Tab" && open && suggestions.length > 0) {
      const choice = suggestions[highlightIndex] ?? suggestions[0];
      if (choice) {
        pick(choice);
      }
    }
  };

  return (
    <div ref={wrapRef} className="grid gap-1">
      <Input
        id={id}
        value={query}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={ariaInvalid}
        aria-activedescendant={
          open && suggestions[highlightIndex]
            ? `${listId}-${suggestions[highlightIndex].id}`
            : undefined
        }
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          if (productId) onSelect(null);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="max-h-48 overflow-y-auto rounded-lg bg-popover py-1 text-sm shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">
              {t("noProducts")}
            </li>
          ) : (
            suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`${listId}-${product.id}`}
                role="option"
                aria-selected={index === highlightIndex}
              >
                <button
                  type="button"
                  className={
                    index === highlightIndex
                      ? "flex w-full items-center px-2.5 py-1.5 text-left bg-accent text-accent-foreground"
                      : "flex w-full items-center px-2.5 py-1.5 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => pick(product)}
                >
                  <span className="truncate font-medium">{product.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
