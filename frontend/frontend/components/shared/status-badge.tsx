"use client";

import { useTranslations } from "next-intl";
import { cva, type VariantProps } from "class-variance-authority";
import type { CustomerActionStatus, TokenStatus } from "@/src/lib/api/customer";
import type { ShippingStatus } from "@/src/lib/api/order";
import {
  actionStatusLabel,
  shippingStatusLabel,
  tokenStatusLabel,
} from "@/src/lib/i18n-labels";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

const statusBadgeVariants = cva(
  "fk-badge inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        success:
          "fk-badge-success bg-[var(--status-success-bg)] text-[var(--status-success-fg)]",
        warning:
          "fk-badge-warning bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)]",
        danger:
          "fk-badge-danger bg-[var(--status-danger-bg)] text-[var(--status-danger-fg)]",
        info: "fk-badge-info bg-[var(--status-info-bg)] text-[var(--status-info-fg)]",
        neutral:
          "fk-badge-neutral bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

const TOKEN_VARIANT: Record<TokenStatus, StatusVariant> = {
  HOLDING: "info",
  EXCHANGED: "neutral",
  CASHED_OUT: "neutral",
  ORDERED: "success",
  CANCELLED: "danger",
};

const ACTION_VARIANT: Record<CustomerActionStatus, StatusVariant> = {
  UNDETERMINED: "neutral",
  NEGOTIATING: "warning",
  CONSOLIDATING: "info",
  NEEDS_IMMEDIATE_ORDER: "danger",
};

const SHIPPING_VARIANT: Record<ShippingStatus, StatusVariant> = {
  ORDER_CREATED: "warning",
  SHIPPED: "info",
  COMPLETED: "success",
};

export function tokenStatusVariant(status: TokenStatus | string): StatusVariant {
  return TOKEN_VARIANT[status as TokenStatus] ?? "neutral";
}

export function actionStatusVariant(
  status: CustomerActionStatus
): StatusVariant {
  return ACTION_VARIANT[status];
}

export function shippingStatusVariant(
  status: ShippingStatus
): StatusVariant {
  return SHIPPING_VARIANT[status];
}

type BaseProps = {
  className?: string;
};

type StatusBadgeProps =
  | (BaseProps & {
      type: "token";
      status: TokenStatus | string;
      children?: never;
      variant?: never;
    })
  | (BaseProps & {
      type: "action";
      status: CustomerActionStatus;
      children?: never;
      variant?: never;
    })
  | (BaseProps & {
      type: "shipping";
      status: ShippingStatus | null | undefined;
      children?: never;
      variant?: never;
    })
  | (BaseProps & {
      type: "lowStock";
      status?: never;
      children?: React.ReactNode;
      variant?: never;
    })
  | (BaseProps & {
      type?: never;
      status?: never;
      variant: StatusVariant;
      children: React.ReactNode;
    });

/**
 * Shared status badge — maps domain enums to semantic variants
 * (success / warning / danger / info / neutral) using --status-* tokens.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const tStatus = useTranslations("common.status");
  const tProducts = useTranslations("products.list");
  const tCustomers = useTranslations("customers.badges");

  let variant: StatusVariant = "neutral";
  let label: React.ReactNode = null;

  if ("variant" in props && props.variant) {
    variant = props.variant;
    label = props.children;
  } else if (props.type === "token") {
    variant = tokenStatusVariant(props.status);
    label = tokenStatusLabel(tStatus, props.status);
  } else if (props.type === "action") {
    variant = actionStatusVariant(props.status);
    label = actionStatusLabel(tStatus, props.status);
  } else if (props.type === "shipping") {
    if (!props.status) {
      variant = "neutral";
      label = tCustomers("noOrderYet");
    } else {
      variant = shippingStatusVariant(props.status);
      label = shippingStatusLabel(tStatus, props.status);
    }
  } else if (props.type === "lowStock") {
    variant = "warning";
    label = props.children ?? tProducts("lowStock");
  }

  return (
    <span
      data-slot="status-badge"
      data-variant={variant}
      className={cn(statusBadgeVariants({ variant }), props.className)}
    >
      {label}
    </span>
  );
}

export { statusBadgeVariants };
export type { VariantProps };
