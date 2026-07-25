"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
  onRetry: () => void;
  className?: string;
};

/** Distinct from empty states — bordered destructive panel with Retry. */
export function QueryErrorState({ message, onRetry, className }: Props) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/30 bg-destructive/5 p-4",
        className
      )}
    >
      <p className="text-sm text-destructive">{message}</p>
      <Button
        className="mt-3"
        variant="outline"
        size="sm"
        onClick={() => onRetry()}
      >
        Retry
      </Button>
    </div>
  );
}
