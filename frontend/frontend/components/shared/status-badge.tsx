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

export type StatusChipColors = { bg: string; fg: string; border: string };

const BADGE_BASE =
  "fk-badge inline-flex h-5 w-fit shrink-0 items-center justify-center rounded-4xl px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Local UI colors for action-status chips — not stored in the database. */
export const ACTION_STATUS_COLORS: Record<
  CustomerActionStatus,
  StatusChipColors
> = {
  UNDETERMINED: { bg: "#f8f9fa", fg: "#212529", border: "#dee2e6" },
  NEEDS_NEGOTIATE: { bg: "#fff3cd", fg: "#b45309", border: "#f59e0b" },
  NEGOTIATING: { bg: "#212529", fg: "#f8f9fa", border: "#212529" },
  CONSOLIDATING: { bg: "#e4c1f9", fg: "#7209b7", border: "#7209b7" },
  NEEDS_IMMEDIATE_ORDER: { bg: "#fadde1", fg: "#d62828", border: "#d62828" },
};

/** Local UI colors for shipping-status chips — not stored in the database. */
export const SHIPPING_STATUS_COLORS: Record<ShippingStatus, StatusChipColors> =
  {
    ORDER_CREATED: { bg: "#ffee93", fg: "#212529", border: "#ffbe0b" },
    SHIPPED: { bg: "#e1ecf7", fg: "#3a3b9c", border: "#3a3b9c" },
    COMPLETED: { bg: "#1f6924", fg: "#f8f9fa", border: "#1f6924" },
  };

export function tokenStatusVariant(status: TokenStatus | string): StatusVariant {
  return TOKEN_VARIANT[status as TokenStatus] ?? "neutral";
}

export function actionStatusColors(status: CustomerActionStatus) {
  return ACTION_STATUS_COLORS[status];
}

export function shippingStatusColors(status: ShippingStatus) {
  return SHIPPING_STATUS_COLORS[status];
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
 * Action/shipping statuses use fixed local hex palettes instead.
 */
export function StatusBadge(props: StatusBadgeProps) {
  const tStatus = useTranslations("common.status");
  const tProducts = useTranslations("products.list");
  const tCustomers = useTranslations("customers.badges");

  let variant: StatusVariant = "neutral";
  let label: React.ReactNode = null;
  let chipColors: StatusChipColors | null = null;

  if ("variant" in props && props.variant) {
    variant = props.variant;
    label = props.children;
  } else if (props.type === "token") {
    variant = tokenStatusVariant(props.status);
    label = tokenStatusLabel(tStatus, props.status);
  } else if (props.type === "action") {
    chipColors = ACTION_STATUS_COLORS[props.status];
    label = actionStatusLabel(tStatus, props.status);
  } else if (props.type === "shipping") {
    if (!props.status) {
      variant = "neutral";
      label = tCustomers("noOrderYet");
    } else {
      chipColors = SHIPPING_STATUS_COLORS[props.status];
      label = shippingStatusLabel(tStatus, props.status);
    }
  } else if (props.type === "lowStock") {
    variant = "warning";
    label = props.children ?? tProducts("lowStock");
  }

  return (
    <span
      data-slot="status-badge"
      data-variant={chipColors ? props.type : variant}
      data-action-status={
        props.type === "action" ? props.status : undefined
      }
      data-shipping-status={
        props.type === "shipping" ? props.status ?? undefined : undefined
      }
      className={cn(
        chipColors ? BADGE_BASE : statusBadgeVariants({ variant }),
        props.className
      )}
      style={
        chipColors
          ? {
              backgroundColor: chipColors.bg,
              color: chipColors.fg,
              borderColor: chipColors.border,
            }
          : undefined
      }
    >
      {label}
    </span>
  );
}

export { statusBadgeVariants };
export type { VariantProps };
