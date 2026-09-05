"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/src/lib/api/client";
import { stockCountApi, stockCountKeys } from "@/src/lib/api/stock-count";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateStockCountDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("stocktake.create");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setFormError(null);
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => stockCountApi.create(note),
    onSuccess: async (stockCount) => {
      await queryClient.invalidateQueries({ queryKey: stockCountKeys.lists() });
      onOpenChange(false);
      router.push(`/stocktake/${stockCount.id}`);
    },
    onError: (err: unknown) => {
      setFormError(err instanceof ApiError ? err.message : t("failed"));
    },
  });

  const handleOpenChange = (next: boolean) => {
    if (!next) mutation.reset();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={mutation.isPending} className="grid gap-2">
          <Label htmlFor="stock-count-note">{t("note")}</Label>
          <Textarea
            id="stock-count-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            rows={2}
          />
          {formError && <p className="text-sm text-destructive">{formError}</p>}
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            {tCommon("actions.cancel")}
          </Button>
          <PendingButton
            type="button"
            pending={mutation.isPending}
            pendingLabel={tCommon("pending.creating")}
            onClick={() => mutation.mutate()}
          >
            {t("confirm")}
          </PendingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
