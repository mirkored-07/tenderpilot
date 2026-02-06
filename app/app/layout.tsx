import { AuthGate } from "./_components/auth-gate";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SideNav } from "./_components/side-nav";
import { TelemetryInit } from "./_components/telemetry-init";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30 overflow-x-hidden">
      <TelemetryInit />
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="hidden md:flex flex-col border-r border-white/5 bg-background/70 backdrop-blur-xl">
          <div className="h-16 px-6 flex items-center justify-between">
            <Link href="/app/jobs" className="font-semibold text-lg tracking-tight">
              TenderRay
            </Link>
          </div>

          <Separator />

          <SideNav />

          <div className="mt-auto p-4">
            <div className="rounded-2xl glass-card p-4">
              <p className="text-xs text-muted-foreground">Credits</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant="secondary" className="rounded-full">
                  2
                </Badge>
                <span className="text-xs text-muted-foreground">test</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                Each tender review consumes 1 credit. Upgrade later via pricing.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-col">
          <header className="h-16 border-b border-white/5 bg-background/90 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="md:hidden font-semibold">TenderRay</div>
              <div>
                <p className="text-sm font-medium leading-none">TenderRay</p>
                <p className="text-xs text-muted-foreground">
                  Go or no go in minutes. Draft bids faster.
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-background/70 dark:bg-zinc-900/50 px-2 py-1.5 shadow-sm backdrop-blur-md hover:opacity-90 transition">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>TP</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block text-sm pr-1">Account</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/app/account">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">Sign out</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
			<div className="mx-auto max-w-7xl">
              <AuthGate>{children}</AuthGate>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
