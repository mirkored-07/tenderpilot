"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

function titleFromPath(pathname: string): string {
  if (!pathname) return "TenderPilot";
  if (pathname === "/app/jobs") return "Jobs";
  if (pathname.startsWith("/app/jobs/")) return "Job";
  if (pathname === "/app/upload") return "New bid";
  if (pathname.startsWith("/app/upload")) return "New bid";
  if (pathname === "/app/dashboard") return "Dashboard";
  if (pathname.startsWith("/app/bid-room")) return "Bid room";
  if (pathname === "/app/account") return "Account";
  if (pathname.startsWith("/app/account")) return "Account";
  return "TenderPilot";
}

export function AppPageTitle() {
  const pathname = usePathname();

  const title = useMemo(() => titleFromPath(pathname), [pathname]);
  return <span className="truncate">{title}</span>;
}
