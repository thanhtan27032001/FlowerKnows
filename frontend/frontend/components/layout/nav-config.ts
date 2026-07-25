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

export type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  section: NavSectionId;
  mobile: MobilePlacement;
};

/** Single source of truth for app routes, labels, icons, and grouping. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    shortLabel: "Home",
    icon: LayoutDashboardIcon,
    section: "dashboard",
    mobile: "more",
  },
  {
    href: "/campaigns",
    label: "Campaigns",
    shortLabel: "Campaigns",
    icon: MegaphoneIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/customers",
    label: "Customers",
    shortLabel: "Customers",
    icon: UsersIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/orders",
    label: "Orders",
    shortLabel: "Orders",
    icon: ShoppingBagIcon,
    section: "operations",
    mobile: "primary",
  },
  {
    href: "/products",
    label: "Products",
    shortLabel: "Products",
    icon: PackageIcon,
    section: "management",
    mobile: "more",
  },
  {
    href: "/alerts",
    label: "Alerts",
    shortLabel: "Alerts",
    icon: BellIcon,
    section: "management",
    mobile: "more",
  },
  {
    href: "/reports",
    label: "Reports",
    shortLabel: "Reports",
    icon: BarChart3Icon,
    section: "management",
    mobile: "more",
  },
] as const;

const SECTION_META: ReadonlyArray<{
  id: NavSectionId;
  label: string | null;
}> = [
  { id: "dashboard", label: null },
  { id: "operations", label: "Operations" },
  { id: "management", label: "Management" },
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
