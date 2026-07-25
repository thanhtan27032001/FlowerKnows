"use client";

import { cn } from "@/lib/utils";

type Props = {
  active: boolean;
  className?: string;
};

/** Thin indeterminate bar for background refetches (isFetching && !isLoading). */
export function QueryProgressBar({ active, className }: Props) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden",
        className
      )}
      role="progressbar"
      aria-hidden={!active}
      aria-valuetext={active ? "Updating" : undefined}
    >
      <div
        className={cn(
          "h-full w-1/3 rounded-full bg-primary transition-opacity duration-150",
          active
            ? "fk-query-progress opacity-100"
            : "opacity-0 motion-reduce:transition-none"
        )}
      />
    </div>
  );
}
