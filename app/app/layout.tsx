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
import { SignOutMenuItem } from "./_components/sign-out-menu-item";
import { UiDensityInit } from "./_components/ui-density-init";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen premium-bg bg-background">
      <TelemetryInit />
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[280px_1fr]">
	  <UiDensityInit />

        <aside className="hidden md:flex flex-col border-r bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/40">
          <div className="h-16 px-6 flex items-center justify-between">
            <Link href="/app/jobs" className="font-semibold text-lg tracking-tight">
              TenderPilot
            </Link>
            <span className="text-[10px] rounded-full border px-2 py-1 text-muted-foreground">
              MVP
            </span>
          </div>

          <Separator />

          <SideNav />

          <div className="mt-auto p-4">
            <div className="rounded-2xl border bg-background/60 p-4 shadow-sm">
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
          <header className="h-16 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40 flex items-center justify-between px-4 md:px-8">
            <div className="flex items-center gap-3">
              <div className="md:hidden font-semibold">TenderPilot</div>
              <div>
                <p className="text-sm font-medium leading-none">TenderPilot</p>
                <p className="text-xs text-muted-foreground">
                  Go or no go in minutes. Draft bids faster.
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <div className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-sm hover:bg-muted/50 transition">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback>TP</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block text-sm pr-1">Account</span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/app/account">Account</Link>
                </DropdownMenuItem>
                <SignOutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="tp-app-main flex-1 px-4 py-6 md:px-8 md:py-8 bg-muted/20">
			<div className="tp-app-container mx-auto max-w-6xl">
              <AuthGate>{children}</AuthGate>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
