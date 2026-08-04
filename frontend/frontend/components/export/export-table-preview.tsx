"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PackingListTable } from "@/components/export/packing-list-table";
import { PendingButton } from "@/components/feedback/pending-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useExportTableAsImage } from "@/hooks/use-export-table-as-image";
import type { ExportCustomerGroup } from "@/src/lib/export/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ExportCustomerGroup[];
  filename: string;
};

/** Shared US-36 / US-37 preview → export dialog. */
export function ExportTablePreview({
  open,
  onOpenChange,
  groups,
  filename,
}: Props) {
  const t = useTranslations("common.export");
  const tCommon = useTranslations("common");
  const tableRef = useRef<HTMLDivElement>(null);
  const { exporting, exportFromElement } = useExportTableAsImage();
  const [error, setError] = useState<string | null>(null);

  const labels = {
    customer: t("columns.customer"),
    item: t("columns.item"),
    quantity: t("columns.quantity"),
  };

  const handleExport = async () => {
    const el = tableRef.current;
    if (!el) {
      setError(t("failed"));
      return;
    }

    setError(null);
    try {
      await exportFromElement(el, filename);
    } catch (err) {
      console.error("Packing-list image export failed", err);
      setError(t("failed"));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (exporting) return;
        setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>{t("previewDescription")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50dvh] overflow-auto rounded-lg border border-border bg-white p-2">
          <PackingListTable
            groups={groups}
            labels={labels}
            rootRef={tableRef}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("actions.cancel")}
          </Button>
          <PendingButton
            type="button"
            pending={exporting}
            pendingLabel={t("downloading")}
            onClick={() => void handleExport()}
          >
            {t("download")}
          </PendingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
