"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  cancelEnabled?: boolean;
  /** When false, the action buttons are not rendered (Staff read-only). */
  showActions?: boolean;
  onItemExchange: () => void;
  onCashOut: () => void;
  onCreateOrder: () => void;
  onCancel: () => void;
};

export function CustomerTokenActionBar({
  selectedCount,
  cancelEnabled = true,
  showActions = true,
  onItemExchange,
  onCashOut,
  onCreateOrder,
  onCancel,
}: Props) {
  const t = useTranslations("customers.actionBar");
  const visible = selectedCount >= 1 && showActions;

  if (!showActions) {
    return null;
  }

  return (
    <div
      className={cn(
        "fk-above-mobile-nav fixed inset-x-0 z-50 p-3 md:p-4",
        "transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-full opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div className="mx-auto max-w-6xl rounded-2xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p className="text-sm font-medium">
            {visible
              ? t("selected", { count: selectedCount })
              : t("selectPrompt")}
          </p>
          {visible && selectedCount > 1 && (
            <p className="text-xs text-muted-foreground">
              {t("cancelRequiresOne")}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="sm"
            disabled={!visible}
            onClick={onItemExchange}
            className="w-full"
            tabIndex={visible ? undefined : -1}
          >
            {t("itemExchange")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!visible}
            onClick={onCashOut}
            className="w-full"
            tabIndex={visible ? undefined : -1}
          >
            {t("cashOut")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!visible}
            onClick={onCreateOrder}
            className="w-full"
            tabIndex={visible ? undefined : -1}
          >
            {t("createOrder")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!visible || !cancelEnabled}
            onClick={onCancel}
            className="w-full"
            tabIndex={visible ? undefined : -1}
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
