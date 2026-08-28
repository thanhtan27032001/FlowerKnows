"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import {
  campaignApi,
  campaignKeys,
  type BalanceResult,
  type CampaignDetail,
  type ParticipantSummary,
  type ParticipantTurn,
} from "@/src/lib/api/campaign";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  confirmedParticipants: ParticipantSummary[];
  onBalanceChecked: (result: BalanceResult) => void;
};

export function AddParticipantTurnForm({
  open,
  onOpenChange,
  campaign,
  confirmedParticipants,
  onBalanceChecked,
}: Props) {
  const t = useTranslations("campaigns.addTurn");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { succeeded, runSuccess, reset } = useSuccessClose(250);

  const [participantId, setParticipantId] = useState("");
  const [bagCount, setBagCount] = useState("1");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { campaignParticipantId: string; bagCount: number; note: string | null }) =>
      campaignApi.createParticipantTurn(campaign.id, input),
    onSuccess: async (created) => {
      queryClient.setQueryData(
        campaignKeys.participantTurns(campaign.id),
        (current: ParticipantTurn[] | undefined) => [...(current ?? []), created]
      );
      onBalanceChecked({
        isBalanced: created.isBalanced,
        difference: created.difference,
        campaignParticipantId: created.campaignParticipantId,
        customerName: created.customerName,
      });
      await runSuccess(() => onOpenChange(false));
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const locked = mutation.isPending || succeeded;

  const submit = () => {
    setFormError(null);
    if (!participantId) {
      setFieldError(t("participantRequired"));
      return;
    }
    const value = Number(bagCount);
    if (!bagCount || Number.isNaN(value) || !Number.isInteger(value) || value < 1) {
      setFieldError(t("bagCountInvalid"));
      return;
    }
    setFieldError(null);
    mutation.mutate({
      campaignParticipantId: participantId,
      bagCount: value,
      note: note.trim() === "" ? null : note,
    });
  };

  const formBody = (
    <fieldset disabled={locked} className="min-w-0 space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="add-turn-participant">{t("participant")}</Label>
        <Select value={participantId} onValueChange={(v) => setParticipantId(v ?? "")}>
          <SelectTrigger id="add-turn-participant" className="w-full">
            <SelectValue placeholder={t("participantPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {confirmedParticipants.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.customerName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-turn-bag-count">{t("bagCount")}</Label>
        <Input
          id="add-turn-bag-count"
          type="number"
          min={1}
          inputMode="numeric"
          value={bagCount}
          onChange={(e) => setBagCount(e.target.value)}
          aria-invalid={!!fieldError}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="add-turn-note">{t("note")}</Label>
        <Input
          id="add-turn-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
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
