"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { productApi, productKeys } from "@/src/lib/api/product";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateProductForm({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
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

  const reset = () => {
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
      onOpenChange(false);
      reset();
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : "Failed to create product");
    },
  });

  const validate = () => {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = "Name is required";
    const price = Number(listPrice);
    if (!listPrice || Number.isNaN(price) || price <= 0) {
      errors.listPrice = "List price must be a positive number";
    }
    const stock = Number(stockQuantity);
    if (stockQuantity === "" || Number.isNaN(stock) || stock < 0 || !Number.isInteger(stock)) {
      errors.stockQuantity = "Initial stock must be a whole number ≥ 0";
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
        setFormError(err instanceof ApiError ? err.message : "Could not check product name");
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
      <div className="grid gap-2">
        <Label htmlFor="product-name">Name</Label>
        <Input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Little Angel Blush"
          aria-invalid={!!fieldErrors.name}
        />
        {fieldErrors.name && (
          <p className="text-xs text-destructive">{fieldErrors.name}</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="product-price">List price (VND)</Label>
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
        <Label htmlFor="product-stock">Initial stock (optional)</Label>
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
    </form>
  );

  const footer = (
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          onOpenChange(false);
          reset();
        }}
      >
        Cancel
      </Button>
      <Button
        type="button"
        disabled={createMutation.isPending}
        onClick={() => void submit(false)}
      >
        {createMutation.isPending ? "Creating…" : "Create Product"}
      </Button>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  return (
    <>
      {isMobile ? (
        <Sheet open={open} onOpenChange={handleOpenChange}>
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>Create Product</SheetTitle>
              <SheetDescription>
                Add a product for campaigns, exchanges, and stock-in.
              </SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-2">{formBody}</div>
            <SheetFooter>{footer}</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Product</DialogTitle>
              <DialogDescription>
                Add a product for campaigns, exchanges, and stock-in.
              </DialogDescription>
            </DialogHeader>
            {formBody}
            <DialogFooter>{footer}</DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate product name</AlertDialogTitle>
            <AlertDialogDescription>
              A product named &ldquo;{pendingPayload?.name}&rdquo; already exists.
              Creating another with the same name can skew reports. Create anyway,
              or cancel and select the existing product instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDuplicateOpen(false);
                setPendingPayload(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDuplicateOpen(false);
                void submit(true);
              }}
            >
              Create anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
