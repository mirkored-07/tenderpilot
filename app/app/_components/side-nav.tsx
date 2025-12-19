"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

const nav: NavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/new", label: "New Bid Kit" },
  { href: "/app/jobs", label: "History" },
  { href: "/app/account", label: "Account" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <div className="px-3 py-4">
      <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
        Workspace
      </p>

      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all",
                "hover:bg-muted/60 hover:text-foreground",
                active
                  ? "bg-muted text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground"
              )}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
