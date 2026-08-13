"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { InfoIcon } from "lucide-react";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
  type PoolItemInput,
  type UpdateCampaignInput,
} from "@/src/lib/api/campaign";
import { productApi, productKeys } from "@/src/lib/api/product";
import {
  CampaignPoolEditor,
  poolRowsFromItems,
  type CampaignPoolRow,
} from "@/components/campaigns/campaign-pool-editor";
import { useCampaignPoolOverlays } from "@/components/campaigns/campaign-pool-overlays";
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
  const { overlayButtons, overlays, closeOverlays } = useCampaignPoolOverlays();

  const poolLocked = isPoolLocked(campaign);

  const [name, setName] = useState(campaign.name);
  const [eventDate, setEventDate] = useState(campaign.eventDate);
  const [totalBags, setTotalBags] = useState(String(campaign.totalBags));
  const [poolRows, setPoolRows] = useState<CampaignPoolRow[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const originalLoadedByProductId = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of campaign.pool) {
      map.set(item.productId, item.loadedQuantity);
    }
    return map;
  }, [campaign.pool]);

  useEffect(() => {
    if (!open) return;
    setName(campaign.name);
    setEventDate(campaign.eventDate);
    setTotalBags(String(campaign.totalBags));
    setPoolRows(
      campaign.pool.length === 0
        ? []
        : poolRowsFromItems(
            campaign.pool.map((item) => ({
              productId: item.productId,
              loadedQuantity: item.loadedQuantity,
            }))
          )
    );
    setFieldErrors({});
    setFormError(null);
  }, [open, campaign]);

  const { data: products = [] } = useQuery({
    queryKey: productKeys.lists(),
    queryFn: () => productApi.list(),
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
    }) =>
      campaignApi.update(campaign.id, {
        ...payload.details,
        ...(payload.pool ? { pool: payload.pool } : {}),
      }),
    onSuccess: async (updatedCampaign, variables) => {
      queryClient.setQueryData(
        campaignKeys.detail(campaign.id),
        (current: CampaignDetail | undefined) => ({
          ...updatedCampaign,
          // Mutation response skips participant token stats; keep cached list.
          participants: current?.participants ?? updatedCampaign.participants,
          bagsSold: current?.bagsSold ?? updatedCampaign.bagsSold,
        })
      );
      void queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      if (variables.pool) {
        void queryClient.invalidateQueries({ queryKey: productKeys.all });
      }
      await runSuccess(() => onOpenChange(false));
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = updateMutation.isPending || succeeded;

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
        const originalLoaded = originalLoadedByProductId.get(row.productId) ?? 0;
        const delta = qty - originalLoaded;
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
            <CampaignPoolEditor
              products={products}
              rows={poolRows}
              onChange={setPoolRows}
              disabled={locked}
              requireAtLeastOne={false}
              title={null}
            />
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
    <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      {!poolLocked ? overlayButtons(locked) : null}
      <Button
        type="button"
        variant="outline"
        disabled={locked}
        onClick={() => {
          closeOverlays();
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
    if (!next) {
      closeOverlays();
      reset();
    }
  };

  // Nested inside Dialog/Sheet root so Base UI stacks overlays correctly
  // without closing or resetting Campaign form state (US-24 AC#5).
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
        {!poolLocked ? overlays : null}
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
      {!poolLocked ? overlays : null}
    </Dialog>
  );
}
