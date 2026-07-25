"use client";

import { StatusBadge } from "@/components/shared/status-badge";
import type { CustomerActionStatus } from "@/src/lib/api/customer";
import type { ShippingStatus } from "@/src/lib/api/order";

/** @deprecated Prefer `<StatusBadge type="action" status={…} />` */
export function ActionStatusBadge({
  status,
  className,
}: {
  status: CustomerActionStatus;
  className?: string;
}) {
  return <StatusBadge type="action" status={status} className={className} />;
}

/** @deprecated Prefer `<StatusBadge type="shipping" status={…} />` */
export function ShippingStatusBadge({
  status,
  className,
}: {
  status: ShippingStatus | null | undefined;
  className?: string;
}) {
  return <StatusBadge type="shipping" status={status} className={className} />;
}
