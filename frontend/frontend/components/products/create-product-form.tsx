"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProductForm({ open, onOpenChange }: Props) {
  const t = useTranslations("products.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<{
    name: string;
    listPrice: number;
    stockQuantity: number;
  } | null>(null);

  const resetForm = () => {
    setName("");
    setListPrice("");
    setStockQuantity("0");
    setFieldErrors({});
    setFormError(null);
    setPendingPayload(null);
  };

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
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = createMutation.isPending || succeeded;

  const validate = () => {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = t("nameRequired");
    const price = Number(listPrice);
    if (!listPrice || Number.isNaN(price) || price <= 0) {
      errors.listPrice = t("listPriceInvalid");
    }
    const stock = Number(stockQuantity);
    if (stockQuantity === "" || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.stockQuantity = t("stockInvalid");
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0
      ? { name: trimmed, listPrice: price, stockQuantity: stock }
      : null;
  };

  const submit = async (confirmDuplicate = false) => {
    setFormError(null);
    const payload = pendingPayload ?? validate();
    if (!payload) return;

    if (!confirmDuplicate) {
      try {
        const { exists } = await productApi.nameExists(payload.name);
        if (exists) {
          setPendingPayload(payload);
          setDuplicateOpen(true);
          return;
        }
      } catch (err) {
        setFormError(err instanceof ApiError ? err.message : t("nameCheckFailed"));
        return;
      }
    }

    createMutation.mutate({
      ...payload,
      confirmDuplicate,
    });
  };

  const formBody = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
    >
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="product-name">{t("name")}</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="product-price">{t("listPrice")}</Label>
          <Input
            id="product-price"
            type="number"
            min={1}
            inputMode="numeric"
            value={listPrice}
            onChange={(e) => setListPrice(e.target.value)}
            placeholder="150000"
            aria-invalid={!!fieldErrors.listPrice}
          />
          {fieldErrors.listPrice && (
            <p className="text-xs text-destructive">{fieldErrors.listPrice}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="product-stock">{t("initialStock")}</Label>
          <Input
            id="product-stock"
            type="number"
            min={0}
            inputMode="numeric"
            value={stockQuantity}
            onChange={(e) => setStockQuantity(e.target.value)}
            aria-invalid={!!fieldErrors.stockQuantity}
          />
          {fieldErrors.stockQuantity && (
            <p className="text-xs text-destructive">{fieldErrors.stockQuantity}</p>
          )}
        </div>

        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </fieldset>
    </form>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      {/* <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => {
          onOpenChange(false);
          reset();
          resetForm();
        }}
      >
        {tCommon("actions.cancel")}
      </Button> */}
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

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      reset();
      resetForm();
    }
  };

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
          <DialogContent className="sm:max-w-md">
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
              {t("duplicateDescription", { name: pendingPayload?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDuplicateOpen(false);
                setPendingPayload(null);
              }}
            >
              {tCommon("actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateOpen(false);
                void submit(true);
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
