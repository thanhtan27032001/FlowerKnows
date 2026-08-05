"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PackingListTable } from "@/components/export/packing-list-table";
import { Spinner } from "@/components/feedback/spinner";
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
import {
  revokeExportImage,
  useExportTableAsImage,
  type PreparedExportImage,
} from "@/hooks/use-export-table-as-image";
import type { ExportCustomerGroup } from "@/src/lib/export/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: ExportCustomerGroup[];
  filename: string;
};

/** Shared US-36 / US-37 preview → native share / download dialog. */
export function ExportTablePreview({
  open,
  onOpenChange,
  groups,
  filename,
}: Props) {
  const t = useTranslations("common.export");
  const tCommon = useTranslations("common");
  const tableRef = useRef<HTMLDivElement>(null);
  const preparedRef = useRef<PreparedExportImage | null>(null);
  const {
    preparing,
    delivering,
    supportsNativeShare,
    prepareFromElement,
    sharePrepared,
    downloadPrepared,
  } = useExportTableAsImage();
  const [prepared, setPrepared] = useState<PreparedExportImage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const labels = {
    customer: t("columns.customer"),
    item: t("columns.item"),
    quantity: t("columns.quantity"),
  };

  const clearPrepared = () => {
    revokeExportImage(preparedRef.current);
    preparedRef.current = null;
    setPrepared(null);
  };

  // Pre-render PNG when the dialog opens so Share keeps the click gesture.
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      const el = tableRef.current;
      if (!el) {
        setError(t("failed"));
        return;
      }
      void prepareFromElement(el, filename)
        .then((next) => {
          if (cancelled) {
            revokeExportImage(next);
            return;
          }
          revokeExportImage(preparedRef.current);
          preparedRef.current = next;
          setPrepared(next);
          setError(null);
        })
        .catch((err) => {
          console.error("Packing-list image prepare failed", err);
          if (!cancelled) setError(t("failed"));
        });
    }, 50);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, groups, filename, prepareFromElement, t]);

  const busy = preparing || delivering;

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (!next) {
      clearPrepared();
      setError(null);
    }
    onOpenChange(next);
  };

  const handleShare = async () => {
    if (!prepared) return;
    setError(null);
    try {
      await sharePrepared(prepared);
    } catch (err) {
      console.error("Packing-list image share failed", err);
      setError(t("failed"));
    }
  };

  const handleDownload = () => {
    if (!prepared) return;
    setError(null);
    try {
      downloadPrepared(prepared);
    } catch (err) {
      console.error("Packing-list image download failed", err);
      setError(t("failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("previewTitle")}</DialogTitle>
          <DialogDescription>
            {supportsNativeShare
              ? t("previewDescriptionShare")
              : t("previewDescription")}
          </DialogDescription>
        </DialogHeader>

        {/* Source table for html2canvas — off-screen, kept mounted while open. */}
        {open && (
          <div
            aria-hidden
            className="pointer-events-none fixed top-0 left-[-10000px] w-[520px] bg-white"
          >
            <PackingListTable
              groups={groups}
              labels={labels}
              rootRef={tableRef}
            />
          </div>
        )}

        <div className="max-h-[50dvh] overflow-auto rounded-lg border border-border bg-white p-2">
          {prepared ? (
            // Native long-press "Save Image" needs a real <img>, not HTML.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prepared.objectUrl}
              alt={t("previewAlt")}
              className="mx-auto h-auto w-full select-none"
              draggable={false}
            />
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-5" />
              <span>{t("preparing")}</span>
            </div>
          )}
        </div>

        {supportsNativeShare && prepared && (
          <p className="text-xs text-muted-foreground">{t("longPressHint")}</p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            {tCommon("actions.cancel")}
          </Button>
          {supportsNativeShare ? (
            <>
              <PendingButton
                type="button"
                pending={delivering}
                pendingLabel={t("sharing")}
                disabled={!prepared || preparing}
                onClick={() => void handleShare()}
              >
                {t("share")}
              </PendingButton>
              <Button
                type="button"
                variant="secondary"
                disabled={!prepared || busy}
                onClick={handleDownload}
              >
                {t("download")}
              </Button>
            </>
          ) : (
            <PendingButton
              type="button"
              pending={preparing}
              pendingLabel={t("downloading")}
              disabled={!prepared || preparing}
              onClick={handleDownload}
            >
              {t("download")}
            </PendingButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
