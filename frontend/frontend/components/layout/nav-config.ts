import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  BellIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PackageIcon,
  ShoppingBagIcon,
  UsersIcon,
} from "lucide-react";

export type NavSectionId = "dashboard" | "operations" | "management";
export type MobilePlacement = "primary" | "more";

export type NavLabelKey =
  | "dashboard"
  | "dashboardShort"
  | "campaigns"
  | "customers"
  | "orders"
  | "products"
  | "alerts"
  | "reports";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  shortLabelKey: NavLabelKey;
  icon: LucideIcon;
  section: NavSectionId;
  mobile: MobilePlacement;
};

/** Single source of truth for app routes, icons, and grouping. Labels via next-intl `nav.*`. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    labelKey: "dashboard",
    shortLabelKey: "dashboardShort",
    icon: LayoutDashboardIcon,
    section: "dashboard",
    mobile: "more",
  },
  {
    href: "/campaigns",
    labelKey: "campaigns",
    shortLabelKey: "campaigns",
    icon: MegaphoneIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/customers",
    labelKey: "customers",
    shortLabelKey: "customers",
    icon: UsersIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/orders",
    labelKey: "orders",
    shortLabelKey: "orders",
    icon: ShoppingBagIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/products",
    labelKey: "products",
    shortLabelKey: "products",
    icon: PackageIcon,
    section: "management",
    mobile: "more",
  },
  {
    href: "/alerts",
    labelKey: "alerts",
    shortLabelKey: "alerts",
    icon: BellIcon,
    section: "management",
    mobile: "more",
  },
  {
    href: "/reports",
    labelKey: "reports",
    shortLabelKey: "reports",
    icon: BarChart3Icon,
    section: "management",
    mobile: "more",
  },
] as const;

const SECTION_META: ReadonlyArray<{
  id: NavSectionId;
  labelKey: "operations" | "management" | null;
}> = [
  { id: "dashboard", labelKey: null },
  { id: "operations", labelKey: "operations" },
  { id: "management", labelKey: "management" },
];

export function getNavSections() {
  return SECTION_META.map((section) => ({
    ...section,
    items: NAV_ITEMS.filter((item) => item.section === section.id),
  }));
}

export function getMobilePrimaryItems() {
  return NAV_ITEMS.filter((item) => item.mobile === "primary");
}

export function getMobileMoreItems() {
  return NAV_ITEMS.filter((item) => item.mobile === "more");
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const MORE_NAV_ICON = MoreHorizontalIcon;
