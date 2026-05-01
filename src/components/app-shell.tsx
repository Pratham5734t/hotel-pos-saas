"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Utensils,
  ChefHat,
  ListOrdered,
  Webhook,
  BarChart3,
  Settings,
  LogOut,
  ScrollText,
  BookOpenText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Role = "OWNER" | "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  primary?: boolean;
  /** Roles allowed to see this link. Undefined = visible to all. */
  roles?: ReadonlyArray<Role>;
};

const NAV: ReadonlyArray<NavItem> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: Utensils, primary: true },
  { href: "/kot", label: "Kitchen", icon: ChefHat },
  { href: "/orders", label: "Orders", icon: ListOrdered },
  { href: "/menu", label: "Menu", icon: BookOpenText },
  // Webhook secrets exposed on this page are sensitive — only managers see it.
  { href: "/integrations", label: "Integrations", icon: Webhook, roles: ["OWNER", "MANAGER"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["OWNER", "MANAGER"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const navItems = NAV.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <div className="min-h-screen flex bg-muted/30">
      <aside className="hidden md:flex w-60 flex-col border-r bg-card">
        <div className="px-4 py-4 border-b">
          <div className="flex items-center gap-2 font-semibold">
            <Utensils className="h-5 w-5 text-primary" />
            <span className="truncate">{session?.user?.tenantName ?? "Hotel POS"}</span>
          </div>
          {session?.user?.role ? (
            <Badge variant="secondary" className="mt-2 text-xs">
              {session.user.role}
            </Badge>
          ) : null}
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                  item.primary && !active ? "ring-1 ring-primary/40" : "",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-2 py-3 border-t space-y-2">
          <div className="px-3 text-xs text-muted-foreground truncate">
            {session?.user?.email}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b bg-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Utensils className="h-5 w-5 text-primary" />
            <span className="truncate">{session?.user?.tenantName ?? "Hotel POS"}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="h-4 w-4" />
          </Button>
        </header>
        <nav className="md:hidden border-b bg-card overflow-x-auto">
          <div className="flex gap-1 p-2 min-w-max">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <main className="flex-1 min-w-0">{children}</main>
        <footer className="hidden md:block border-t bg-card px-4 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <ScrollText className="h-3 w-3 inline" /> Hotel POS — multi-tenant.
        </footer>
      </div>
    </div>
  );
}
