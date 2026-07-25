"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CreateCampaignInput,
} from "@/src/lib/api/campaign";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";
import { createClientId } from "@/lib/utils";

type PoolRow = {
  key: string;
  productId: string;
  loadedQuantity: string;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function newPoolRow(): PoolRow {
  return {
    key: createClientId(),
    productId: "",
    loadedQuantity: "",
  };
}

export function CreateCampaignForm({ open, onOpenChange }: Props) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [bagPrice, setBagPrice] = useState("");
  const [totalBags, setTotalBags] = useState("");
  const [poolRows, setPoolRows] = useState<PoolRow[]>([newPoolRow()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
    enabled: open,
  });

  const poolSum = useMemo(
    () =>
      poolRows.reduce((sum, row) => {
        const qty = Number(row.loadedQuantity);
        return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
      }, 0),
    [poolRows]
  );

  const totalBagsNum = Number(totalBags);
  const quantitiesMatch =
    totalBags !== "" &&
    Number.isInteger(totalBagsNum) &&
    totalBagsNum > 0 &&
    poolSum === totalBagsNum;

  const resetForm = () => {
    setName("");
    setEventDate("");
    setBagPrice("");
    setTotalBags("");
    setPoolRows([newPoolRow()]);
    setFieldErrors({});
    setFormError(null);
  };

  const createMutation = useMutation({
    mutationFn: campaignApi.create,
    onSuccess: async (campaign) => {
      await queryClient.invalidateQueries({ queryKey: campaignKeys.all });
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => {
        onOpenChange(false);
        resetForm();
        router.push(`/campaigns/${campaign.id}`);
      });
    },
    onError: (err: unknown) => {
      setFormError(
        err instanceof ApiError ? err.message : "Failed to create campaign"
      );
    },
  });

  const locked = createMutation.isPending || succeeded;

  const updateRow = (key: string, patch: Partial<PoolRow>) => {
    setPoolRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const validate = (): CreateCampaignInput | null => {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = "Name is required";
    if (!eventDate) errors.eventDate = "Event date is required";

    const price = Number(bagPrice);
    if (!bagPrice || Number.isNaN(price) || price <= 0) {
      errors.bagPrice = "Bag price must be a positive number";
    }

    const bags = Number(totalBags);
    if (!totalBags || Number.isNaN(bags) || bags < 1 || !Number.isInteger(bags)) {
      errors.totalBags = "Total bags must be a whole number ≥ 1";
    }

    let poolValid = true;
    const nextRows = poolRows.map((row) => {
      const qty = Number(row.loadedQuantity);
      if (!row.productId) {
        poolValid = false;
        return { ...row, error: "Select a product" };
      }
      if (
        !row.loadedQuantity ||
        Number.isNaN(qty) ||
        qty < 1 ||
        !Number.isInteger(qty)
      ) {
        poolValid = false;
        return { ...row, error: "Loaded quantity must be a whole number ≥ 1" };
      }
      const product = products.find((p) => p.id === row.productId);
      if (product && qty > product.stockQuantity) {
        poolValid = false;
        return {
          ...row,
          error: `Only ${product.stockQuantity} available in stock`,
        };
      }
      return { ...row, error: undefined };
    });
    setPoolRows(nextRows);

    if (!poolValid) {
      errors.pool = "Fix product pool rows before submitting";
    } else if (bags > 0 && poolSum !== bags) {
      errors.pool = `Sum of loaded quantities (${poolSum}) must equal total bags (${bags})`;
    }

    const productIds = nextRows.map((r) => r.productId).filter(Boolean);
    if (new Set(productIds).size !== productIds.length) {
      errors.pool = "Each product can only appear once in the pool";
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !poolValid) return null;

    return {
      name: trimmed,
      eventDate,
      bagPrice: price,
      totalBags: bags,
      pool: nextRows.map((row) => ({
        productId: row.productId,
        loadedQuantity: Number(row.loadedQuantity),
      })),
    };
  };

  const submit = () => {
    setFormError(null);
    const payload = validate();
    if (!payload) return;
    createMutation.mutate(payload);
  };

  const formBody = (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset disabled={locked} className="min-w-0 space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="campaign-name">Name</Label>
          <Input
            id="campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Little Angel Blind Bag — Aug"
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="campaign-event-date">Event date</Label>
          <Input
            id="campaign-event-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-invalid={!!fieldErrors.eventDate}
          />
          {fieldErrors.eventDate && (
            <p className="text-xs text-destructive">{fieldErrors.eventDate}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="campaign-bag-price">Bag price (VND)</Label>
            <Input
              id="campaign-bag-price"
              type="number"
              min={1}
              inputMode="numeric"
              value={bagPrice}
              onChange={(e) => setBagPrice(e.target.value)}
              placeholder="89000"
              aria-invalid={!!fieldErrors.bagPrice}
            />
            {fieldErrors.bagPrice && (
              <p className="text-xs text-destructive">{fieldErrors.bagPrice}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campaign-total-bags">Total bags (N)</Label>
            <Input
              id="campaign-total-bags"
              type="number"
              min={1}
              inputMode="numeric"
              value={totalBags}
              onChange={(e) => setTotalBags(e.target.value)}
              placeholder="50"
              aria-invalid={!!fieldErrors.totalBags}
            />
            {fieldErrors.totalBags && (
              <p className="text-xs text-destructive">{fieldErrors.totalBags}</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <Label>Product pool</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Loaded sum:{" "}
                <span
                  className={
                    quantitiesMatch
                      ? "font-medium text-foreground"
                      : "font-medium text-destructive"
                  }
                >
                  {poolSum}
                </span>
                {totalBags ? ` / ${totalBags}` : ""}
                {!quantitiesMatch && totalBags
                  ? " — must equal total bags"
                  : ""}
              </p>
            </div>
          </div>

          {poolRows.map((row, index) => {
            const selected = products.find((p) => p.id === row.productId);
            return (
              <div
                key={row.key}
                className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Product {index + 1}
                  </p>
                  {poolRows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setPoolRows((prev) =>
                          prev.filter((r) => r.key !== row.key)
                        )
                      }
                      aria-label="Remove row"
                    >
                      <Trash2Icon />
                    </Button>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Product</Label>
                  <Select
                    value={row.productId || undefined}
                    onValueChange={(value) =>
                      updateRow(row.key, { productId: String(value ?? "") })
                    }
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.stockQuantity} in stock)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Loaded quantity</Label>
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={row.loadedQuantity}
                    onChange={(e) =>
                      updateRow(row.key, { loadedQuantity: e.target.value })
                    }
                    aria-invalid={!!row.error}
                  />
                  {selected && (
                    <p className="text-xs text-muted-foreground">
                      Available stock: {selected.stockQuantity}
                    </p>
                  )}
                </div>

                {row.error && (
                  <p className="text-xs text-destructive">{row.error}</p>
                )}
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            onClick={() => setPoolRows((prev) => [...prev, newPoolRow()])}
          >
            <PlusIcon />
            Add product
          </Button>

          {fieldErrors.pool && (
            <p className="text-sm text-destructive">{fieldErrors.pool}</p>
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
        onClick={() => {
          onOpenChange(false);
          reset();
          resetForm();
        }}
      >
        Cancel
      </Button>
      <PendingButton
        type="button"
        pending={createMutation.isPending}
        success={succeeded}
        pendingLabel="Creating…"
        disabled={!quantitiesMatch}
        onClick={submit}
      >
        Create Campaign
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

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>Create Campaign</SheetTitle>
            <SheetDescription>
              Load a product pool. Total bags must equal the sum of loaded
              quantities.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Load a product pool. Total bags must equal the sum of loaded
            quantities.
          </DialogDescription>
        </DialogHeader>
        {formBody}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
