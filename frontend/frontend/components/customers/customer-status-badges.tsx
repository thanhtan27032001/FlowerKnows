import { Badge } from "@/components/ui/badge";
import {
  ACTION_STATUS_LABEL,
  type CustomerActionStatus,
} from "@/src/lib/api/customer";
import { SHIPPING_LABEL, type ShippingStatus } from "@/src/lib/api/order";
import { cn } from "@/lib/utils";

export function ActionStatusBadge({
  status,
  className,
}: {
  status: CustomerActionStatus;
  className?: string;
}) {
  const urgent = status === "NEEDS_IMMEDIATE_ORDER";
  return (
    <Badge
      variant={urgent ? "destructive" : status === "UNDETERMINED" ? "outline" : "secondary"}
      className={cn(
        status === "NEGOTIATING" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
        status === "CONSOLIDATING" &&
          "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100",
        className
      )}
    >
      {ACTION_STATUS_LABEL[status]}
    </Badge>
  );
}

export function ShippingStatusBadge({
  status,
  className,
}: {
  status: ShippingStatus | null | undefined;
  className?: string;
}) {
  if (!status) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        No order yet
      </Badge>
    );
  }

  const urgent = status === "ORDER_CREATED";
  return (
    <Badge
      variant={
        urgent ? "default" : status === "COMPLETED" ? "secondary" : "outline"
      }
      className={cn(
        status === "SHIPPED" &&
          "border-violet-500/30 bg-violet-500/10 text-violet-950 dark:text-violet-100",
        className
      )}
    >
      {SHIPPING_LABEL[status]}
    </Badge>
  );
}
