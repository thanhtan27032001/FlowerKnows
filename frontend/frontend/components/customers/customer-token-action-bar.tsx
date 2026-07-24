"use client";

import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  cancelEnabled?: boolean;
  onItemExchange: () => void;
  onCashOut: () => void;
  onCreateOrder: () => void;
  onCancel: () => void;
};

export function CustomerTokenActionBar({
  selectedCount,
  cancelEnabled = true,
  onItemExchange,
  onCashOut,
  onCreateOrder,
  onCancel,
}: Props) {
  const enabled = selectedCount >= 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 md:p-4">
      <div className="pointer-events-auto mx-auto max-w-6xl rounded-2xl border border-border/80 bg-background/95 p-3 shadow-lg backdrop-blur-sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p className="text-sm font-medium">
            {enabled
              ? `${selectedCount} token${selectedCount === 1 ? "" : "s"} selected`
              : "Select tokens to take action"}
          </p>
          {enabled && selectedCount > 1 && (
            <p className="text-xs text-muted-foreground">
              Cancel requires 1 token
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button
            size="sm"
            disabled={!enabled}
            onClick={onItemExchange}
            className="w-full"
          >
            Item Exchange
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!enabled}
            onClick={onCashOut}
            className="w-full"
          >
            Cash Out
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!enabled}
            onClick={onCreateOrder}
            className="w-full"
          >
            Create Order
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!enabled || !cancelEnabled}
            onClick={onCancel}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
