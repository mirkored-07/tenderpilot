import type { ReactNode } from "react";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { AuthGate } from "./_components/auth-gate";
import { SideNav } from "./_components/side-nav";
import { TelemetryInit } from "./_components/telemetry-init";
import { SignOutMenuItem } from "./_components/sign-out-menu-item";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/mode-toggle";

async function supabaseServer() {
  // In this Next version, cookies() is async
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // IMPORTANT: keep cookies readable by the browser Supabase client
            // so client-side RLS writes (bid room overlays, etc.) keep working.
            cookieStore.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );
}

async function loadCreditsBalance(): Promise<number | null> {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) return null;

    // Source of truth: profiles.credits_balance
    const { data, error } = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .maybeSingle();

    // If the column does not exist yet (before SQL is applied), do not break the app.
    if (error) {
      console.error("Failed to load credits_balance", error);
      return null;
    }

    if (data && typeof (data as any).credits_balance === "number") {
      return (data as any).credits_balance as number;
    }

    // If the profile row is missing, try to create it (best effort).
    // The DB default will set credits_balance.
    const email = user.email ?? "";
    const ins = await supabase
      .from("profiles")
      .insert({ id: user.id, email })
      .select("credits_balance")
      .maybeSingle();

    if (
      !ins.error &&
      ins.data &&
      typeof (ins.data as any).credits_balance === "number"
    ) {
      return (ins.data as any).credits_balance as number;
    }

    const again = await supabase
      .from("profiles")
      .select("credits_balance")
      .eq("id", user.id)
      .maybeSingle();

    if (
      !again.error &&
      again.data &&
      typeof (again.data as any).credits_balance === "number"
    ) {
      return (again.data as any).credits_balance as number;
    }

    return null;
  } catch (e) {
    console.error("Unexpected error loading credits_balance", e);
    return null;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const creditsBalance = await loadCreditsBalance();

  return (
    <div className="h-dvh aurora-bg overflow-hidden">
      <TelemetryInit />

      <div className="flex h-dvh min-w-0">
        {/* Sidebar: fixed, never scrolls with page */}
        <aside className="hidden md:flex fixed inset-y-0 left-0 w-[280px] z-40 flex-col bg-gradient-to-b from-teal-600 via-cyan-700 to-sky-800 text-white">
          <div className="h-16 px-6 flex items-center justify-between">
            <Link
              href="/app/jobs"
              className="font-semibold text-lg tracking-tight"
            >
              TenderPilot
            </Link>
          </div>

          <Separator className="bg-white/15" />

          {/* Nav scrolls only inside sidebar, footer pinned */}
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <SideNav />
            </div>

            <div className="border-t border-white/15 p-4 space-y-4">
              <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/15">
                <p className="text-xs font-medium text-white/80">Credits</p>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full">
                    {typeof creditsBalance === "number" ? creditsBalance : "—"}
                  </Badge>
                  <span className="text-xs font-medium text-white/80">
                    remaining
                  </span>
                </div>
                <p className="mt-3 text-xs text-white/75 leading-relaxed">
                  Each tender review consumes 1 credit. Exports are gated on the
                  free tier.
                </p>
              </div>

              <div className="flex w-full items-center justify-between px-2">
                <span className="text-xs font-medium text-white/80">Theme</span>
                <div className="[&_button]:text-white [&_svg]:text-white">
                  <ModeToggle />
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main column: only this scrolls */}
        <div className="flex min-w-0 flex-1 flex-col md:pl-[280px]">
          <header className="h-16 sticky top-0 z-30 border-b border-border bg-background/70 backdrop-blur flex items-center justify-between px-4 md:px-8">
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
                <div className="flex items-center gap-2 rounded-full border border-border bg-card/70 px-2 py-1.5 shadow-sm backdrop-blur hover:opacity-90 transition">
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
                <SignOutMenuItem />
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-7xl">
              <AuthGate>{children}</AuthGate>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}