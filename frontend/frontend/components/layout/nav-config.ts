import type { LucideIcon } from "lucide-react";
import {
  BarChart3Icon,
  BellIcon,
  LayoutDashboardIcon,
  MegaphoneIcon,
  MoreHorizontalIcon,
  PackageIcon,
  ShoppingBagIcon,
  SparklesIcon,
  StoreIcon,
  UsersIcon,
  UserCogIcon,
} from "lucide-react";
import type { AccountRole } from "@/src/lib/auth/session";

export type NavSectionId = "dashboard" | "operations" | "management";
export type MobilePlacement = "primary" | "more";

export type NavLabelKey =
  | "dashboard"
  | "dashboardShort"
  | "campaigns"
  | "suggestCampaign"
  | "customers"
  | "orders"
  | "directSales"
  | "products"
  | "alerts"
  | "reports"
  | "accounts";

export type NavItem = {
  href: string;
  labelKey: NavLabelKey;
  shortLabelKey: NavLabelKey;
  icon: LucideIcon;
  section: NavSectionId;
  mobile: MobilePlacement;
  /** If set, only these roles see the item. Default: both. */
  roles?: readonly AccountRole[];
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
    roles: ["OWNER"],
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
    href: "/campaigns/suggest",
    labelKey: "suggestCampaign",
    shortLabelKey: "suggestCampaign",
    icon: SparklesIcon,
    section: "operations",
    mobile: "more",
    roles: ["OWNER"],
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
    href: "/direct-sales",
    labelKey: "directSales",
    shortLabelKey: "directSales",
    icon: StoreIcon,
    section: "operations",
    mobile: "more",
  },
  {
    href: "/orders",
    labelKey: "orders",
    shortLabelKey: "orders",
    icon: ShoppingBagIcon,
    section: "operations",
    mobile: "primary",
    roles: ["OWNER"],
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
    roles: ["OWNER"],
  },
  {
    href: "/reports",
    labelKey: "reports",
    shortLabelKey: "reports",
    icon: BarChart3Icon,
    section: "management",
    mobile: "more",
    roles: ["OWNER"],
  },
  {
    href: "/accounts",
    labelKey: "accounts",
    shortLabelKey: "accounts",
    icon: UserCogIcon,
    section: "management",
    mobile: "more",
    roles: ["OWNER"],
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

function visibleForRole(item: NavItem, role: AccountRole) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes(role);
}

export function getNavItemsForRole(role: AccountRole) {
  return NAV_ITEMS.filter((item) => visibleForRole(item, role));
}

export function getNavSections(role: AccountRole) {
  const items = getNavItemsForRole(role);
  return SECTION_META.map((section) => ({
    ...section,
    items: items.filter((item) => item.section === section.id),
  })).filter((section) => section.items.length > 0);
}

export function getMobilePrimaryItems(role: AccountRole) {
  return getNavItemsForRole(role).filter((item) => item.mobile === "primary");
}

export function getMobileMoreItems(role: AccountRole) {
  return getNavItemsForRole(role).filter((item) => item.mobile === "more");
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/campaigns") {
    if (pathname === "/campaigns") return true;
    if (pathname.startsWith("/campaigns/suggest")) return false;
    return pathname.startsWith("/campaigns/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const MORE_NAV_ICON = MoreHorizontalIcon;
