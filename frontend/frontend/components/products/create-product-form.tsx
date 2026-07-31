"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys } from "@/src/lib/api/product";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";
import { createClientId } from "@/lib/utils";

type Row = {
  key: string;
  name: string;
  listPrice: string;
  stockQuantity: string;
  costPrice: string;
  error?: string;
};

type LineError = { lineIndex: number; productId: string | null; message: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function newRow(): Row {
  return {
    key: createClientId(),
    name: "",
    listPrice: "",
    stockQuantity: "0",
    costPrice: "",
  };
}

export function CreateProductForm({ open, onOpenChange }: Props) {
  const t = useTranslations("products.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [duplicateNames, setDuplicateNames] = useState<string[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState(false);

  const resetForm = () => {
    setRows([newRow()]);
    setFormError(null);
    setDuplicateNames([]);
    setPendingConfirm(false);
  };

  useEffect(() => {
    if (!open) return;
    resetForm();
    reset();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- reset on open only

  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        resetForm();
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        const body = err.body as Record<string, unknown> | null;
        const lineErrors =
          body && Array.isArray(body.lineErrors)
            ? (body.lineErrors as LineError[])
            : null;
        if (lineErrors && lineErrors.length > 0) {
          setRows((prev) =>
            prev.map((row, i) => {
              const fault = lineErrors.find((le) => le.lineIndex === i);
              return fault ? { ...row, error: fault.message } : row;
            })
          );
          setFormError(null);
          return;
        }
        setFormError(err.message);
        return;
      }
      setFormError(t("failed"));
    },
  });

  const locked = createMutation.isPending || succeeded;

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const validateRows = (): boolean => {
    let valid = true;
    const next = rows.map((row) => {
      const trimmed = row.name.trim();
      const price = Number(row.listPrice);
      const stock = Number(row.stockQuantity);
      const cost = Number(row.costPrice);

      if (!trimmed) {
        valid = false;
        return { ...row, error: t("nameRequired") };
      }
      if (!row.listPrice || Number.isNaN(price) || price <= 0) {
        valid = false;
        return { ...row, error: t("listPriceInvalid") };
      }
      if (
        row.stockQuantity === "" ||
        Number.isNaN(stock) ||
        stock < 0 ||
        !Number.isInteger(stock)
      ) {
        valid = false;
        return { ...row, error: t("stockInvalid") };
      }
      if (stock > 0 && (row.costPrice.trim() === "" || Number.isNaN(cost) || cost <= 0)) {
        valid = false;
        return { ...row, error: t("costRequired") };
      }
      return { ...row, error: undefined };
    });
    setRows(next);
    return valid;
  };

  const buildPayload = (confirmDuplicate: boolean) => ({
    products: rows.map((row) => {
      const stock = Number(row.stockQuantity);
      return {
        name: row.name.trim(),
        listPrice: Number(row.listPrice),
        stockQuantity: stock,
        costPrice: stock > 0 ? Number(row.costPrice) : undefined,
      };
    }),
    confirmDuplicate,
  });

  const submit = async (confirmDuplicate = false) => {
    setFormError(null);
    if (!confirmDuplicate && !validateRows()) return;

    if (!confirmDuplicate) {
      const names = rows.map((r) => r.name.trim());
      const seen = new Set<string>();
      const dups: string[] = [];
      for (const name of names) {
        const key = name.toLowerCase();
        if (seen.has(key)) {
          if (!dups.some((d) => d.toLowerCase() === key)) dups.push(name);
        } else {
          seen.add(key);
        }
      }

      try {
        for (const name of names) {
          const { exists } = await productApi.nameExists(name);
          if (exists && !dups.some((d) => d.toLowerCase() === name.toLowerCase())) {
            dups.push(name);
          }
        }
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : t("nameCheckFailed"));
        return;
      }

      if (dups.length > 0) {
        setDuplicateNames(dups);
        setPendingConfirm(true);
        setDuplicateOpen(true);
        return;
      }
    }

    createMutation.mutate(buildPayload(confirmDuplicate));
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      {rows.map((row, index) => {
        const stock = Number(row.stockQuantity);
        const showCost = row.stockQuantity !== "" && !Number.isNaN(stock) && stock > 0;
        return (
          <div
            key={row.key}
            className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {index + 1}
              </p>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    setRows((prev) => prev.filter((r) => r.key !== row.key))
                  }
                  aria-label={tCommon("actions.removeRow")}
                >
                  <Trash2Icon />
                </Button>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`product-name-${row.key}`}>{t("name")}</Label>
              <Input
                id={`product-name-${row.key}`}
                value={row.name}
                onChange={(e) => updateRow(row.key, { name: e.target.value })}
                placeholder={t("namePlaceholder")}
                aria-invalid={!!row.error}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`product-price-${row.key}`}>{t("listPrice")}</Label>
                <Input
                  id={`product-price-${row.key}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={row.listPrice}
                  onChange={(e) =>
                    updateRow(row.key, { listPrice: e.target.value })
                  }
                  placeholder="150000"
                  aria-invalid={!!row.error}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`product-stock-${row.key}`}>
                  {t("initialStock")}
                </Label>
                <Input
                  id={`product-stock-${row.key}`}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={row.stockQuantity}
                  onChange={(e) => {
                    const nextStock = e.target.value;
                    const qty = Number(nextStock);
                    updateRow(row.key, {
                      stockQuantity: nextStock,
                      ...(nextStock === "" || Number.isNaN(qty) || qty <= 0
                        ? { costPrice: "" }
                        : {}),
                    });
                  }}
                  aria-invalid={!!row.error}
                />
              </div>
            </div>

            {showCost && (
              <div className="grid gap-2">
                <Label htmlFor={`product-cost-${row.key}`}>{t("costPrice")}</Label>
                <Input
                  id={`product-cost-${row.key}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={row.costPrice}
                  onChange={(e) =>
                    updateRow(row.key, { costPrice: e.target.value })
                  }
                  placeholder="80000"
                  aria-invalid={!!row.error}
                />
              </div>
            )}

            {row.error && (
              <p className="text-xs text-destructive">{row.error}</p>
            )}
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => setRows((prev) => [...prev, newRow()])}
      >
        <PlusIcon />
        {tCommon("actions.addRow")}
      </Button>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </fieldset>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      resetForm();
    }
  };

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => handleOpenChange(false)}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={createMutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.creating")}
        onClick={() => void submit(false)}
      >
        {t("submit")}
      </PendingButton>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="bottom" className="overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{t("title")}</SheetTitle>
              <SheetDescription>{t("description")}</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-2">{formBody}</div>
            <SheetFooter>{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            {formBody}
            <DialogFooter>{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("duplicateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("duplicateDescription", {
                name: duplicateNames.join(", "),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDuplicateOpen(false);
                setPendingConfirm(false);
              }}
            >
              {tCommon("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateOpen(false);
                if (pendingConfirm) void submit(true);
              }}
            >
              {t("createAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
