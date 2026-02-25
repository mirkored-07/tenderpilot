"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };

const nav: NavItem[] = [
  { href: "/app/upload", label: "New bid" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/account", label: "Account" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <div className="px-3 py-4">
      <p className="px-3 pb-2 text-xs font-medium text-white/80">Menu</p>

      <nav className="space-y-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all",
                "hover:bg-white/10 hover:text-white",
                active
                  ? "bg-white/12 text-white shadow-sm ring-1 ring-white/15"
                  : "text-white/75"
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