"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys, type Product } from "@/src/lib/api/product";
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
  product: Product | null;
};

export function EditProductForm({ open, onOpenChange, product }: Props) {
  const t = useTranslations("products.edit");
  const tCreate = useTranslations("products.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);
  const [name, setName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !product) return;
    setName(product.name);
    setFieldErrors({});
    setFormError(null);
    setPendingName(null);
    reset();
  }, [open, product, reset]);

  const mutation = useMutation({
    mutationFn: (input: { name: string; confirmDuplicate?: boolean }) => {
      if (!product) throw new Error("No product");
      return productApi.update(product.id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      if (product) {
        await queryClient.invalidateQueries({
          queryKey: productKeys.detail(product.id),
        });
      }
      await runSuccess(() => {
        onOpenChange(false);
      });
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = mutation.isPending || succeeded || !product;

  const submit = async (confirmDuplicate = false) => {
    if (!product) return;
    setFormError(null);
    const trimmed = (pendingName ?? name).trim();
    if (!trimmed) {
      setFieldErrors({ name: tCreate("nameRequired") });
      return;
    }
    setFieldErrors({});

    if (!confirmDuplicate) {
      try {
        const { exists } = await productApi.nameExists(trimmed, product.id);
        if (exists) {
          setPendingName(trimmed);
          setDuplicateOpen(true);
          return;
        }
      } catch (err) {
        setFormError(
          err instanceof ApiError ? err.message : tCreate("nameCheckFailed")
        );
        return;
      }
    }

    mutation.mutate({ name: trimmed, confirmDuplicate });
    setPendingName(null);
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
          <Label htmlFor="edit-product-name">{tCreate("name")}</Label>
          <Input
            id="edit-product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tCreate("namePlaceholder")}
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>
        {formError && <p className="text-sm text-destructive">{formError}</p>}
      </fieldset>
    </form>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => onOpenChange(false)}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={mutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.saving")}
        onClick={() => void submit(false)}
      >
        {t("submit")}
      </PendingButton>
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={onOpenChange}>
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
        <Dialog open={open} onOpenChange={onOpenChange}>
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
            <AlertDialogTitle>{tCreate("duplicateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tCreate("duplicateDescription", {
                name: pendingName ?? name.trim(),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDuplicateOpen(false);
                setPendingName(null);
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
              {t("saveAnyway")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
