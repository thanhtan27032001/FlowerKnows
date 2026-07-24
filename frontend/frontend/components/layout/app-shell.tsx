import Link from "next/link";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/customers", label: "Customers" },
  { href: "/orders", label: "Orders" },
  { href: "/alerts", label: "Alerts" },
  { href: "/products", label: "Products" },
  { href: "/reports", label: "Reports" },
] as const;

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-[linear-gradient(165deg,#eef5f2_0%,#f7f8f6_38%,#ffffff_100%)]">
      <header className="border-b border-border/60 bg-background/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              className="truncate font-[family-name:var(--font-display)] text-base font-semibold tracking-tight text-foreground"
            >
              Flower Knows
            </Link>
            <nav className="hidden items-center gap-3 text-sm text-muted-foreground lg:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          {actions}
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 text-xs text-muted-foreground lg:hidden md:px-6">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {title}
          </h1>
        </div>
        {children}
      </main>
    </div>
  );
}
