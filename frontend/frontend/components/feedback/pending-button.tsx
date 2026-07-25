"use client";

import { CheckIcon } from "lucide-react";
import { Spinner } from "@/components/feedback/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PendingButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean;
  success?: boolean;
  pendingLabel: string;
  successLabel?: string;
};

export function PendingButton({
  pending = false,
  success = false,
  pendingLabel,
  successLabel = "Done",
  children,
  className,
  disabled,
  ...props
}: PendingButtonProps) {
  return (
    <Button
      className={cn(className)}
      disabled={disabled || pending || success}
      {...props}
    >
      {success ? (
        <span className="inline-flex items-center gap-1.5">
          <CheckIcon className="size-4" aria-hidden />
          <span>{successLabel}</span>
        </span>
      ) : pending ? (
        <span className="inline-flex items-center gap-1.5">
          <Spinner className="size-3.5" />
          <span className="opacity-70">{pendingLabel}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
