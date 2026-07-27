"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
  type PoolItemInput,
  type UpdateCampaignInput,
} from "@/src/lib/api/campaign";
import { productApi, productKeys } from "@/src/lib/api/product";
import { ProductTypeahead } from "@/components/products/product-typeahead";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useSuccessClose } from "@/hooks/use-success-close";
import { createClientId } from "@/lib/utils";

type PoolRow = {
  key: string;
  productId: string;
  loadedQuantity: string;
  originalLoaded: number;
  error?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
};

function isPoolLocked(campaign: CampaignDetail) {
  return campaign.pool.some((p) => p.remainingQuantity !== p.loadedQuantity);
}

export function EditCampaignForm({ open, onOpenChange, campaign }: Props) {
  const t = useTranslations("campaigns.edit");
  const tCreate = useTranslations("campaigns.create");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const poolLocked = isPoolLocked(campaign);

  const [name, setName] = useState(campaign.name);
  const [eventDate, setEventDate] = useState(campaign.eventDate);
  const [totalBags, setTotalBags] = useState(String(campaign.totalBags));
  const [poolRows, setPoolRows] = useState<PoolRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(campaign.name);
    setEventDate(campaign.eventDate);
    setTotalBags(String(campaign.totalBags));
    setPoolRows(
      campaign.pool.map((item) => ({
        key: item.id,
        productId: item.productId,
        loadedQuantity: String(item.loadedQuantity),
        originalLoaded: item.loadedQuantity,
      }))
    );
    setFieldErrors({});
    setFormError(null);
  }, [open, campaign]);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: productApi.list,
    enabled: open && !poolLocked,
  });

  const poolSum = useMemo(
    () =>
      poolRows.reduce((sum, row) => {
        const qty = Number(row.loadedQuantity);
        return sum + (Number.isInteger(qty) && qty > 0 ? qty : 0);
      }, 0),
    [poolRows]
  );

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      details: UpdateCampaignInput;
      pool?: PoolItemInput[];
    }) => {
      let updated = await campaignApi.update(campaign.id, payload.details);
      if (payload.pool) {
        updated = await campaignApi.updatePool(campaign.id, { pool: payload.pool });
      }
      return updated;
    },
    onSuccess: async (updatedCampaign) => {
      queryClient.setQueryData(campaignKeys.detail(campaign.id), updatedCampaign);
      void queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: productKeys.all });
      await runSuccess(() => onOpenChange(false));
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = updateMutation.isPending || succeeded;

  const updateRow = (key: string, patch: Partial<PoolRow>) => {
    setPoolRows((prev) =>
      prev.map((row) =>
        row.key === key ? { ...row, ...patch, error: undefined } : row
      )
    );
  };

  const validate = (): {
    details: UpdateCampaignInput;
    pool?: PoolItemInput[];
  } | null => {
    const errors: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errors.name = tCreate("nameRequired");
    if (!eventDate) errors.eventDate = tCreate("eventDateRequired");

    const bags = Number(totalBags);
    if (!totalBags || Number.isNaN(bags) || bags < 1 || !Number.isInteger(bags)) {
      errors.totalBags = tCreate("totalBagsInvalid");
    }

    let pool: PoolItemInput[] | undefined;
    if (!poolLocked) {
      let poolValid = true;
      const nextRows = poolRows.map((row) => {
        const qty = Number(row.loadedQuantity);
        if (!row.productId) {
          poolValid = false;
          return { ...row, error: tCreate("selectProduct") };
        }
        if (
          !row.loadedQuantity ||
          Number.isNaN(qty) ||
          qty < 1 ||
          !Number.isInteger(qty)
        ) {
          poolValid = false;
          return { ...row, error: tCreate("loadedQtyInvalid") };
        }
        const product = products.find((p) => p.id === row.productId);
        const delta = qty - row.originalLoaded;
        if (product && delta > product.stockQuantity) {
          poolValid = false;
          return { ...row, error: t("stockInsufficient") };
        }
        return { ...row, error: undefined };
      });
      setPoolRows(nextRows);

      if (!poolValid || nextRows.length === 0) {
        errors.pool = tCreate("fixPool");
      }

      const productIds = nextRows.map((r) => r.productId).filter(Boolean);
      if (new Set(productIds).size !== productIds.length) {
        errors.pool = tCreate("duplicateProduct");
      }

      if (!errors.pool) {
        pool = nextRows.map((row) => ({
          productId: row.productId,
          loadedQuantity: Number(row.loadedQuantity),
        }));
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return null;

    return {
      details: {
        name: trimmed,
        eventDate,
        totalBags: bags,
      },
      pool,
    };
  };

  const submit = () => {
    setFormError(null);
    const payload = validate();
    if (!payload) return;
    updateMutation.mutate(payload);
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
          <Label htmlFor="edit-campaign-name">{tCreate("name")}</Label>
          <Input
            id="edit-campaign-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-xs text-destructive">{fieldErrors.name}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-campaign-event-date">{tCreate("eventDate")}</Label>
          <Input
            id="edit-campaign-event-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            aria-invalid={!!fieldErrors.eventDate}
          />
          {fieldErrors.eventDate && (
            <p className="text-xs text-destructive">{fieldErrors.eventDate}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-campaign-total-bags">{tCreate("totalBags")}</Label>
          <Input
            id="edit-campaign-total-bags"
            type="number"
            min={1}
            inputMode="numeric"
            value={totalBags}
            onChange={(e) => setTotalBags(e.target.value)}
            aria-invalid={!!fieldErrors.totalBags}
          />
          {fieldErrors.totalBags && (
            <p className="text-xs text-destructive">{fieldErrors.totalBags}</p>
          )}
          {!poolLocked && (
            <p className="text-xs text-muted-foreground">
              {t("poolSumHint", { sum: poolSum })}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>{tCreate("productPool")}</Label>
            {poolLocked && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex text-muted-foreground"
                      aria-label={t("poolLockedTooltip")}
                    >
                      <InfoIcon className="size-3.5" />
                    </button>
                  }
                />
                <TooltipContent>{t("poolLockedTooltip")}</TooltipContent>
              </Tooltip>
            )}
          </div>

          {poolLocked ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
              {t("poolLockedNotice")}
            </p>
          ) : (
            <>
              {poolRows.map((row, index) => {
                const selected = products.find((p) => p.id === row.productId);
                return (
                  <div
                    key={row.key}
                    className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {tCommon("fields.product")} {index + 1}
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
                          aria-label={tCommon("actions.removeRow")}
                        >
                          <Trash2Icon />
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor={`edit-campaign-pool-product-${row.key}`}>
                        {tCommon("fields.product")}
                      </Label>
                      <ProductTypeahead
                        id={`edit-campaign-pool-product-${row.key}`}
                        products={products}
                        productId={row.productId}
                        showStock
                        placeholder={tCreate("productSearchPlaceholder")}
                        aria-invalid={!!row.error}
                        onSelect={(product) =>
                          updateRow(row.key, {
                            productId: product?.id ?? "",
                            originalLoaded: 0,
                          })
                        }
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>{tCreate("loadedQuantity")}</Label>
                      <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={row.loadedQuantity}
                        onChange={(e) =>
                          updateRow(row.key, {
                            loadedQuantity: e.target.value,
                          })
                        }
                        aria-invalid={!!row.error}
                      />
                      {selected && (
                        <p className="text-xs text-muted-foreground">
                          {t("availableStock", {
                            stock: selected.stockQuantity,
                          })}
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
                onClick={() =>
                  setPoolRows((prev) => [
                    ...prev,
                    {
                      key: createClientId(),
                      productId: "",
                      loadedQuantity: "1",
                      originalLoaded: 0,
                    },
                  ])
                }
              >
                <PlusIcon />
                {tCommon("actions.addProduct")}
              </Button>
            </>
          )}

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
        }}
      >
        {tCommon("actions.cancel")}
      </Button>
      <PendingButton
        type="button"
        pending={updateMutation.isPending}
        success={succeeded}
        pendingLabel={tCommon("pending.saving")}
        onClick={submit}
      >
        {t("save")}
      </PendingButton>
    </div>
  );

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  if (isMobile) {
    return (
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
