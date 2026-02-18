"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ModeToggle } from "@/components/mode-toggle";
import { SignOutMenuItem } from "./sign-out-menu-item"; // Assuming you might have this, or remove if unused

type NavItem = {
  href: string;
  label: string;
};

const nav: NavItem[] = [
  { href: "/app/upload", label: "New bid review" },
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/jobs", label: "Jobs" },
  { href: "/app/account", label: "Account" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    // Main container needs full height and flex-col to push footer down
    <div className="flex h-full flex-col px-3 py-4">
      
      {/* TOP SECTION: Navigation */}
      <div className="flex-1 space-y-4">
        <div>
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">
            Workspace
          </p>

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
      </div>

      {/* BOTTOM SECTION: Footer with Toggle */}
      <div className="mt-auto border-t pt-4">
        <div className="flex w-full items-center justify-between px-2">
          <span className="text-xs font-medium text-muted-foreground">Theme</span>
          <ModeToggle />
        </div>
      </div>
      
    </div>
  );
}