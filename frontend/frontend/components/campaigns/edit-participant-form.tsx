"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type CampaignDetail,
  type ParticipantSummary,
} from "@/src/lib/api/campaign";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: CampaignDetail;
  participant: ParticipantSummary;
};

export function EditParticipantForm({
  open,
  onOpenChange,
  campaign,
  participant,
}: Props) {
  const t = useTranslations("campaigns.editParticipant");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [bags, setBags] = useState(String(participant.totalBagsPurchased));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBags(String(participant.totalBagsPurchased));
    setFieldError(null);
    setFormError(null);
  }, [open, participant]);

  const isDraft = participant.status === "DRAFT";
  const bagsSoldExcludingSelf = isDraft
    ? campaign.bagsSold
    : campaign.bagsSold - participant.totalBagsPurchased;
  const remaining = campaign.totalBags - bagsSoldExcludingSelf;
  const minBags = Math.max(1, participant.itemsRecorded);

  const mutation = useMutation({
    mutationFn: async (totalBagsPurchased: number) => {
      const updatedParticipant = await campaignApi.updateParticipant(
        campaign.id,
        participant.id,
        {
          totalBagsPurchased,
        }
      );
      return updatedParticipant;
    },
    onSuccess: async (updatedParticipant) => {
      queryClient.setQueryData(
        campaignKeys.detail(campaign.id),
        (current: CampaignDetail | undefined) => {
          if (!current) return current;
          const deltaBags =
            participant.status === "CONFIRMED"
              ? updatedParticipant.totalBagsPurchased -
                participant.totalBagsPurchased
              : 0;
          return {
            ...current,
            bagsSold: current.bagsSold + deltaBags,
            participants: current.participants.map((p) =>
              p.id === updatedParticipant.id
                ? {
                    ...updatedParticipant,
                    // Bag edits don't change recorded items; keep preview from cache.
                    itemsRecorded: p.itemsRecorded,
                    recordedItemNames: p.recordedItemNames,
                  }
                : p
            ),
          };
        }
      );
      void queryClient.invalidateQueries({ queryKey: campaignKeys.lists() });
      await runSuccess(() => onOpenChange(false));
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = mutation.isPending || succeeded;

  const submit = () => {
    setFormError(null);
    const value = Number(bags);
    if (!bags || Number.isNaN(value) || !Number.isInteger(value) || value < 1) {
      setFieldError(t("bagsInvalid"));
      return;
    }
    if (value < minBags) {
      setFieldError(t("belowRecorded", { count: minBags }));
      return;
    }
    if (!isDraft && value > remaining) {
      setFieldError(
        remaining <= 0 ? t("noBagsRemaining") : t("bagsInvalid")
      );
      return;
    }
    setFieldError(null);
    mutation.mutate(value);
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm">
        <p className="font-medium">{participant.customerName}</p>
        <p className="text-muted-foreground">
          {participant.customerPhone || tCommon("fallback.noPhone")}
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-participant-bags">{t("bagsPurchased")}</Label>
        <Input
          id="edit-participant-bags"
          type="number"
          min={minBags}
          max={isDraft ? undefined : remaining}
          inputMode="numeric"
          value={bags}
          onChange={(e) => setBags(e.target.value)}
          aria-invalid={!!fieldError}
        />
        <p className="text-xs text-muted-foreground">
          {isDraft
            ? t("draftHint")
            : t("remainingHint", { remaining })}
          {participant.itemsRecorded > 0
            ? ` · ${t("recordedFloor", { count: participant.itemsRecorded })}`
            : ""}
        </p>
        {fieldError && (
          <p className="text-xs text-destructive">{fieldError}</p>
        )}
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}
    </fieldset>
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
        pending={mutation.isPending}
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
      <DialogContent className="sm:max-w-md">
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
