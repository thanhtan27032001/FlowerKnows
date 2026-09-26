"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircleIcon, PlusIcon, SaveIcon, SearchIcon, Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import type { Product } from "@/src/lib/api/product";
import {
  stockCountApi,
  stockCountKeys,
  type BulkAddStockCountLineItem,
  type BulkUpdateStockCountLineItem,
  type StockCountLine,
  type UpdateStockCountLineInput,
} from "@/src/lib/api/stock-count";
import { StockCountDiffBadge } from "@/components/stocktake/stock-count-line-row";
import { PendingButton } from "@/components/feedback/pending-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { compareFolded } from "@/src/lib/text-search";
import { useProductSuggestions } from "@/hooks/use-product-suggestions";
import { cn, createClientId } from "@/lib/utils";

export const TABLE_SEARCH_ID = "stocktake-table-search";
const countedCellId = (key: string) => `table-counted-${key}`;

type EditValues = {
  countedQuantity: string;
  costPrice: string;
  note: string;
};

type StagedRow = EditValues & {
  key: string;
  productId: string;
  productName: string;
  systemStockQuantity: number;
};

type TableRowModel = EditValues & {
  key: string;
  kind: "existing" | "staged";
  productId: string;
  productName: string;
  /** line.systemQuantityAtAdd for existing rows, live product.stockQuantity for staged rows. */
  systemStockQuantity: number;
  line?: StockCountLine;
  dirty: boolean;
};

type Built<T> = { item: T | null; error: string | null };

function serverValues(line: StockCountLine): EditValues {
  return {
    countedQuantity: line.countedQuantity != null ? String(line.countedQuantity) : "",
    costPrice: line.costPrice != null ? String(line.costPrice) : "",
    note: line.note ?? "",
  };
}

function parseCounted(text: string) {
  const trimmed = text.trim();
  return trimmed === "" ? null : Number(trimmed);
}

/** Same rule as the card view: cost price only matters when the count exceeds stock. */
function showsCostPrice(row: EditValues & { systemStockQuantity: number }) {
  const counted = parseCounted(row.countedQuantity);
  return counted != null && Number.isFinite(counted) && counted > row.systemStockQuantity;
}

type Props = {
  stockCountId: string;
  lines: StockCountLine[];
  products: Product[];
  readOnly: boolean;
  onCreateProduct: () => void;
};

export function StockCountTableView({
  stockCountId,
  lines,
  products,
  readOnly,
  onCreateProduct,
}: Props) {
  const t = useTranslations("stocktake.detail");
  const tTable = useTranslations("stocktake.table");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  // Local-only until "Lưu tất cả": edits over existing lines + staged new rows.
  const [edits, setEdits] = useState<Record<string, EditValues>>({});
  const [staged, setStaged] = useState<StagedRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TableRowModel | null>(null);

  /** Validated update for an existing row; item is null when nothing sendable changed. */
  const buildUpdate = (row: TableRowModel): Built<BulkUpdateStockCountLineItem> => {
    const line = row.line!;
    const input: UpdateStockCountLineInput = {};
    const counted = parseCounted(row.countedQuantity);
    if (counted == null) {
      if (line.countedQuantity != null) return { item: null, error: tTable("countedCannotClear") };
    } else if (!Number.isInteger(counted) || counted < 0) {
      return { item: null, error: tTable("countedInvalid") };
    } else if (counted !== line.countedQuantity) {
      input.countedQuantity = counted;
    }
    if (showsCostPrice(row) && row.costPrice.trim() !== "") {
      const cost = Number(row.costPrice.trim());
      if (!Number.isFinite(cost) || cost <= 0) return { item: null, error: tTable("costInvalid") };
      if (cost !== line.costPrice) input.costPrice = cost;
    }
    if (row.note.trim() !== (line.note ?? "")) input.note = row.note.trim();
    return {
      item: Object.keys(input).length > 0 ? { lineId: line.id, ...input } : null,
      error: null,
    };
  };

  const buildAdd = (row: TableRowModel): Built<BulkAddStockCountLineItem> => {
    const counted = parseCounted(row.countedQuantity);
    if (counted != null && (!Number.isInteger(counted) || counted < 0)) {
      return { item: null, error: tTable("countedInvalid") };
    }
    let costPrice: number | undefined;
    if (showsCostPrice(row) && row.costPrice.trim() !== "") {
      costPrice = Number(row.costPrice.trim());
      if (!Number.isFinite(costPrice) || costPrice <= 0) {
        return { item: null, error: tTable("costInvalid") };
      }
    }
    return {
      item: {
        productId: row.productId,
        countedQuantity: counted ?? undefined,
        costPrice,
        note: row.note.trim() || undefined,
      },
      error: null,
    };
  };

  const rows: TableRowModel[] = useMemo(() => {
    const existing = lines.map((line): TableRowModel => {
      const base = serverValues(line);
      const values = edits[line.id] ?? base;
      return {
        key: line.id,
        kind: "existing",
        productId: line.productId,
        productName: line.productName,
        systemStockQuantity: line.systemQuantityAtAdd,
        line,
        ...values,
        dirty: false,
      };
    });
    const stagedRows = staged.map(
      (row): TableRowModel => ({ ...row, kind: "staged", dirty: true })
    );
    return [...existing, ...stagedRows];
  }, [lines, edits, staged]);

  // Dirty = something sendable changed, or the typed value is invalid (so Save surfaces it).
  const rowsWithDirty = rows.map((row) => {
    if (row.kind === "staged") return row;
    const { item, error } = buildUpdate(row);
    return { ...row, dirty: item != null || error != null };
  });
  const dirtyCount = rowsWithDirty.filter((r) => r.dirty).length;

  const usedProductIds = useMemo(
    () => new Set(rows.map((r) => r.productId)),
    [rows]
  );
  const searchableProducts = useMemo(
    () =>
      products
        .filter((p) => !usedProductIds.has(p.id))
        .sort((a, b) => compareFolded(a.name, b.name)),
    [products, usedProductIds]
  );

  const clearRowError = (key: string) =>
    setRowErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  const editRow = (row: TableRowModel, patch: Partial<EditValues>) => {
    clearRowError(row.key);
    if (row.kind === "staged") {
      setStaged((prev) => prev.map((r) => (r.key === row.key ? { ...r, ...patch } : r)));
      return;
    }
    setEdits((prev) => ({
      ...prev,
      [row.key]: { ...(prev[row.key] ?? serverValues(row.line!)), ...patch },
    }));
  };

  const stageProduct = (product: Product) => {
    setStaged((prev) => [
      ...prev,
      {
        key: createClientId(),
        productId: product.id,
        productName: product.name,
        systemStockQuantity: product.stockQuantity,
        countedQuantity: "",
        costPrice: "",
        note: "",
      },
    ]);
  };

  const removeStaged = (key: string) => {
    clearRowError(key);
    setStaged((prev) => prev.filter((r) => r.key !== key));
  };

  const removeMutation = useMutation({
    mutationFn: (lineId: string) => stockCountApi.removeLine(stockCountId, lineId),
    onSuccess: async (_, lineId) => {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[lineId];
        return next;
      });
      clearRowError(lineId);
      await queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof ApiError ? err.message : t("saveFailed"));
    },
  });

  const requestRemove = (row: TableRowModel) => {
    if (row.kind === "staged") {
      removeStaged(row.key);
      return;
    }
    const line = row.line!;
    const hasData =
      line.countedQuantity != null ||
      line.costPrice != null ||
      !!line.note?.trim() ||
      row.countedQuantity.trim() !== "" ||
      row.costPrice.trim() !== "" ||
      row.note.trim() !== "";
    if (hasData) setConfirmRemove(row);
    else removeMutation.mutate(line.id);
  };

  type SaveBatch = {
    addItems: BulkAddStockCountLineItem[];
    addKeys: string[];
    updateItems: BulkUpdateStockCountLineItem[];
    /** The edit objects that were sent, so edits typed during the request survive. */
    sentEdits: Record<string, EditValues | undefined>;
  };

  const saveMutation = useMutation({
    mutationFn: async (batch: SaveBatch) => {
      const [addResult, updateResult] = await Promise.allSettled([
        batch.addItems.length > 0
          ? stockCountApi.addLinesBulk(stockCountId, { items: batch.addItems })
          : Promise.resolve(null),
        batch.updateItems.length > 0
          ? stockCountApi.updateLinesBulk(stockCountId, { items: batch.updateItems })
          : Promise.resolve(null),
      ]);
      return { batch, addResult, updateResult };
    },
    onSuccess: async ({ batch, addResult, updateResult }) => {
      const failures: unknown[] = [];
      let saved = 0;

      if (addResult.status === "fulfilled") {
        const sent = new Set(batch.addKeys);
        setStaged((prev) => prev.filter((r) => !sent.has(r.key)));
        const response = addResult.value;
        if (response) {
          saved += response.added.length;
          if (response.skippedProductIds.length > 0) {
            toast.info(tTable("skipped", { count: response.skippedProductIds.length }));
          }
        }
      } else {
        failures.push(addResult.reason);
      }

      if (updateResult.status === "fulfilled") {
        setEdits((prev) => {
          const next = { ...prev };
          for (const [lineId, sentEdit] of Object.entries(batch.sentEdits)) {
            if (next[lineId] === sentEdit) delete next[lineId];
          }
          return next;
        });
        saved += batch.updateItems.length;
      } else {
        failures.push(updateResult.reason);
      }

      if (saved > 0) {
        await queryClient.invalidateQueries({ queryKey: stockCountKeys.detail(stockCountId) });
        toast.success(tTable("saved", { count: saved }));
      }

      if (failures.length > 0) {
        const detail = failures.find((f) => f instanceof ApiError) as ApiError | undefined;
        const message = t("saveAllFailed");
        setSaveError(detail ? `${message}: ${detail.message}` : message);
        toast.error(message);
      } else {
        setSaveError(null);
      }
    },
  });

  const saveAll = () => {
    const errors: Record<string, string> = {};
    const addItems: BulkAddStockCountLineItem[] = [];
    const addKeys: string[] = [];
    const updateItems: BulkUpdateStockCountLineItem[] = [];
    const sentEdits: Record<string, EditValues | undefined> = {};
    const existingProductIds = new Set(lines.map((l) => l.productId));
    const stagedProductIds = new Set<string>();

    for (const row of rowsWithDirty) {
      if (!row.dirty) continue;
      if (row.kind === "staged") {
        // Defensive: search already hides these, so this should never trigger (AC #9b).
        if (existingProductIds.has(row.productId) || stagedProductIds.has(row.productId)) {
          errors[row.key] = tTable("duplicateProduct");
          continue;
        }
        stagedProductIds.add(row.productId);
        const { item, error } = buildAdd(row);
        if (error) errors[row.key] = error;
        else if (item) {
          addItems.push(item);
          addKeys.push(row.key);
        }
      } else {
        const { item, error } = buildUpdate(row);
        if (error) errors[row.key] = error;
        else if (item) {
          updateItems.push(item);
          sentEdits[row.key] = edits[row.key];
        }
      }
    }

    setRowErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError(tTable("invalidRows", { count: Object.keys(errors).length }));
      toast.error(tTable("invalidRows", { count: Object.keys(errors).length }));
      return;
    }
    if (addItems.length === 0 && updateItems.length === 0) return;
    saveMutation.mutate({ addItems, addKeys, updateItems, sentEdits });
  };

  /** Enter in a "Thực đếm" cell: next row's cell in table order, else the search box. */
  const onCountedKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = rows[index + 1];
    const target = document.getElementById(next ? countedCellId(next.key) : TABLE_SEARCH_ID);
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const locked = readOnly || saveMutation.isPending;

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex flex-wrap items-start gap-2">
          <ProductAddSearch products={searchableProducts} onAdd={stageProduct} />
          <Button type="button" variant="outline" onClick={onCreateProduct}>
            {t("createProductButton")}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="fk-table-surface">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("product")}</TableHead>
                <TableHead className="w-32">{t("countedQuantity")}</TableHead>
                <TableHead className="w-36">{t("costPriceShort")}</TableHead>
                <TableHead>{t("note")}</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">{t("actionsColumn")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rowsWithDirty.map((row, index) => {
                const error = rowErrors[row.key];
                const counted = parseCounted(row.countedQuantity);
                const diff =
                  counted != null && Number.isFinite(counted)
                    ? counted - row.systemStockQuantity
                    : null;
                const withCost = showsCostPrice(row);
                return (
                  <TableRow
                    key={row.key}
                    className={cn(
                      "align-top",
                      row.kind === "staged" && "bg-[var(--status-info-bg)]/40",
                      row.kind === "existing" && row.dirty && "bg-[var(--status-warning-bg)]/40",
                      error && "bg-destructive/5"
                    )}
                  >
                    <TableCell
                      className={cn(
                        "min-w-48 whitespace-normal",
                        error && "shadow-[inset_3px_0_0_0_var(--destructive)]"
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{row.productName}</span>
                        {row.kind === "staged" && (
                          <StatusBadge variant="info">{tTable("stagedBadge")}</StatusBadge>
                        )}
                        {row.kind === "existing" && row.dirty && (
                          <StatusBadge variant="warning">{tTable("dirtyBadge")}</StatusBadge>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                        <span>
                          {t("systemQuantity")}: {row.systemStockQuantity}
                        </span>
                        <StockCountDiffBadge diff={diff} />
                      </div>
                      {error && (
                        <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                          {error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        id={countedCellId(row.key)}
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`${t("countedQuantity")} — ${row.productName}`}
                        placeholder={t("countedPlaceholder")}
                        disabled={locked}
                        aria-invalid={!!error}
                        value={row.countedQuantity}
                        onChange={(e) => editRow(row, { countedQuantity: e.target.value })}
                        onKeyDown={(e) => onCountedKeyDown(e, index)}
                      />
                    </TableCell>
                    <TableCell>
                      {withCost ? (
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          aria-label={`${t("costPrice")} — ${row.productName}`}
                          title={t("costPriceHint")}
                          disabled={locked}
                          aria-invalid={!!error}
                          value={row.costPrice}
                          onChange={(e) => editRow(row, { costPrice: e.target.value })}
                        />
                      ) : (
                        <span className="block py-2 text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-40">
                      <Input
                        aria-label={`${t("note")} — ${row.productName}`}
                        placeholder={t("notePlaceholder")}
                        disabled={locked}
                        value={row.note}
                        onChange={(e) => editRow(row, { note: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={saveMutation.isPending || removeMutation.isPending}
                          onClick={() => requestRemove(row)}
                          aria-label={t("removeLine")}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!readOnly && (
        <div className="sticky bottom-[calc(var(--fk-mobile-bottom-nav-offset)+0.75rem)] z-10 lg:bottom-4">
          <div
            className={cn(
              "grid gap-2 rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur",
              saveError
                ? "border-destructive ring-3 ring-destructive/20 dark:border-destructive/60"
                : "border-border"
            )}
          >
            {saveError && (
              <p role="alert" className="flex items-start gap-2 text-sm font-medium text-destructive">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                {saveError}
              </p>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {dirtyCount > 0
                  ? tTable("unsavedHint", { count: dirtyCount })
                  : tTable("allSaved")}
              </p>
              <PendingButton
                type="button"
                disabled={dirtyCount === 0}
                pending={saveMutation.isPending}
                pendingLabel={tCommon("pending.saving")}
                onClick={saveAll}
              >
                <SaveIcon />
                {t("saveAllButton", { count: dirtyCount })}
              </PendingButton>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={confirmRemove != null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeLineConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("removeLineConfirmDescription", { product: confirmRemove?.productName ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("actions.cancel")}</AlertDialogCancel>
            <PendingButton
              type="button"
              variant="destructive"
              pending={removeMutation.isPending}
              pendingLabel={tCommon("pending.deleting")}
              onClick={() => {
                if (confirmRemove?.line) removeMutation.mutate(confirmRemove.line.id);
                setConfirmRemove(null);
              }}
            >
              {t("removeLineConfirm")}
            </PendingButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Multi-add search: picking a result stages it and keeps the box ready for the next one. */
function ProductAddSearch({
  products,
  onAdd,
}: {
  products: Product[];
  onAdd: (product: Product) => void;
}) {
  const t = useTranslations("stocktake.table");
  const tStockIn = useTranslations("products.stockIn");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const suggestions = useProductSuggestions(products, query);
  const listId = `${TABLE_SEARCH_ID}-suggestions`;
  const activeIndex = Math.min(highlightIndex, Math.max(suggestions.length - 1, 0));

  const pick = (product: Product) => {
    onAdd(product);
    setQuery("");
    setHighlightIndex(0);
    setOpen(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex(Math.min(activeIndex + 1, suggestions.length - 1));
    } else if (event.key === "ArrowUp" && suggestions.length > 0) {
      event.preventDefault();
      setHighlightIndex(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Enter" && open && suggestions[activeIndex]) {
      event.preventDefault();
      pick(suggestions[activeIndex]);
    }
  };

  return (
    <div className="relative min-w-64 flex-1">
      <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        id={TABLE_SEARCH_ID}
        value={query}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && suggestions[activeIndex] ? `${listId}-${suggestions[activeIndex].id}` : undefined
        }
        placeholder={t("searchPlaceholder")}
        className="pl-8"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlightIndex(0);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg bg-popover py-1 text-sm shadow-md ring-1 ring-foreground/10"
        >
          {suggestions.length === 0 ? (
            <li className="px-2.5 py-2 text-muted-foreground">{tStockIn("noProducts")}</li>
          ) : (
            suggestions.map((product, index) => (
              <li
                key={product.id}
                id={`${listId}-${product.id}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors",
                    index === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  // Keep focus in the search box so the next product can be typed immediately.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightIndex(index)}
                  onClick={() => pick(product)}
                >
                  <span className="min-w-0 truncate font-medium">{product.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {tStockIn("stock")} {product.stockQuantity}
                    <PlusIcon className="size-4" />
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
