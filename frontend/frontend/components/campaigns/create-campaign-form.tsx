"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CreateCampaignInput,
  type PoolItemInput,
} from "@/src/lib/api/campaign";
import { productApi, productKeys } from "@/src/lib/api/product";
import {
  CampaignPoolEditor,
  newCampaignPoolRow,
  poolRowsFromItems,
  type CampaignPoolRow,
} from "@/components/campaigns/campaign-pool-editor";
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
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";

export type CreateCampaignPrefill = {
  bagPrice: number;
  totalBags: number;
  pool: PoolItemInput[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, pre-fills bag price / total bags / pool (US-31). Name & date stay blank. */
  initialValues?: CreateCampaignPrefill | null;
};

export function CreateCampaignForm({
  open,
  onOpenChange,
  initialValues = null,
}: Props) {
  const t = useTranslations("campaigns.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [bagPrice, setBagPrice] = useState("89000");
  const [totalBags, setTotalBags] = useState("20");
  const [poolRows, setPoolRows] = useState<CampaignPoolRow[]>([
    newCampaignPoolRow(),
  ]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initialValues) {
      setName("");
      setEventDate("");
      setBagPrice(String(initialValues.bagPrice));
      setTotalBags(String(initialValues.totalBags));
      setPoolRows(poolRowsFromItems(initialValues.pool));
      setFieldErrors({});
      setFormError(null);
    }
  }, [open, initialValues]);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productApi.list(),
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
  const poolWithinLimit =
    totalBags !== "" &&
    Number.isInteger(totalBagsNum) &&
    totalBagsNum > 0 &&
    poolSum <= totalBagsNum;

  const resetForm = () => {
    setName("");
    setEventDate("");
    setBagPrice("89000");
    setTotalBags("20");
    setPoolRows([newCampaignPoolRow()]);
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
        err instanceof ApiError ? err.message : t("failed")
      );
    },
  });

  const locked = createMutation.isPending || succeeded;

  const validate = (): CreateCampaignInput | null => {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = t("nameRequired");
    if (!eventDate) errors.eventDate = t("eventDateRequired");

    const price = Number(bagPrice);
    if (!bagPrice || Number.isNaN(price) || price <= 0) {
      errors.bagPrice = t("bagPriceInvalid");
    }

    const bags = Number(totalBags);
    if (!totalBags || Number.isNaN(bags) || bags < 1 || !Number.isInteger(bags)) {
      errors.totalBags = t("totalBagsInvalid");
    }

    let poolValid = true;
    const activeRows = poolRows.filter((row) => row.productId);
    const nextRows = poolRows.map((row) => {
      if (!row.productId) {
        return { ...row, error: undefined };
      }
      const qty = Number(row.loadedQuantity);
      if (
        !row.loadedQuantity ||
        Number.isNaN(qty) ||
        qty < 1 ||
        !Number.isInteger(qty)
      ) {
        poolValid = false;
        return { ...row, error: t("loadedQtyInvalid") };
      }
      const product = products.find((p) => p.id === row.productId);
      if (product && qty > product.stockQuantity) {
        poolValid = false;
        return {
          ...row,
          error: t("loadedQtyInvalid"),
        };
      }
      return { ...row, error: undefined };
    });
    setPoolRows(nextRows);

    if (!poolValid) {
      errors.pool = t("fixPool");
    } else if (bags > 0 && poolSum > bags) {
      errors.pool = t("quantitiesExceed");
    }

    const productIds = activeRows.map((r) => r.productId);
    if (new Set(productIds).size !== productIds.length) {
      errors.pool = t("duplicateProduct");
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !poolValid) return null;

    return {
      name: trimmed,
      eventDate,
      bagPrice: price,
      totalBags: bags,
      pool: activeRows.map((row) => ({
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
          <Label htmlFor="campaign-name">{t("name")}</Label>
          <Input
            id="campaign-name"
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
          <Label htmlFor="campaign-event-date">{t("eventDate")}</Label>
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
            <Label htmlFor="campaign-bag-price">{t("bagPrice")}</Label>
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
            <Label htmlFor="campaign-total-bags">{t("totalBags")}</Label>
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

        <CampaignPoolEditor
          products={products}
          rows={poolRows}
          onChange={setPoolRows}
          totalBags={totalBags}
          disabled={locked}
          requireAtLeastOne={false}
        />

        {fieldErrors.pool && (
          <p className="text-sm text-destructive">{fieldErrors.pool}</p>
        )}

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
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={createMutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.creating")}
        disabled={!poolWithinLimit}
        onClick={submit}
      >
        {t("createButton")}
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
          className="overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>{t("title")}</SheetTitle>
            <SheetDescription>{t("description")}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-2">{formBody}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
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
  );
}
