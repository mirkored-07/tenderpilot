import type { ReactNode } from "react";

import Link from "next/link";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { AuthGate } from "./_components/auth-gate";
import { SideNav } from "./_components/side-nav";
import { TelemetryInit } from "./_components/telemetry-init";
import { AppI18nProvider } from "./_components/app-i18n-provider";
import { SidebarFooter } from "./_components/sidebar-footer";
import { AppHeader } from "./_components/app-header";

import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
          // IMPORTANT:
          // In Next.js (App Router), Server Components (including layouts/pages)
          // are NOT allowed to mutate cookies. Attempting to do so throws:
          // "Cookies can only be modified in a Server Action or Route Handler".
          //
          // We refresh/propagate Supabase cookies in middleware + route handlers.
          // Here we intentionally no-op to avoid runtime crashes.
          void cookiesToSet;
        },
      },
    }
  );
}

async function loadProfileSettings(): Promise<{
  creditsBalance: number | null;
  locale: string | null;
  outputLanguage: string | null;
}> {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { creditsBalance: null, locale: null, outputLanguage: null };
    }

    // Source of truth: profiles.* (robust to missing columns)
    let data: any = null;
    try {
      const res = await supabase
        .from("profiles")
        .select("credits_balance,locale,output_language")
        .eq("id", user.id)
        .maybeSingle();

      if (res.error) throw res.error;
      data = res.data as any;
    } catch (e: any) {
      // If columns do not exist yet (before SQL is applied), do not break the app.
      const msg = String(e?.message ?? "");
      if (msg.includes("locale") || msg.includes("output_language")) {
        const res = await supabase
          .from("profiles")
          .select("credits_balance")
          .eq("id", user.id)
          .maybeSingle();
        data = res.data as any;
      } else {
        console.error("Failed to load profile settings", e);
      }
    }

    if (data && typeof data.credits_balance === "number") {
      return {
        creditsBalance: data.credits_balance as number,
        locale: typeof data.locale === "string" ? data.locale : null,
        outputLanguage: typeof data.output_language === "string" ? data.output_language : null,
      };
    }

    // If the profile row is missing, try to create it (best effort).
    // The DB default will set credits_balance.
    const email = user.email ?? "";
    const ins = await supabase
      .from("profiles")
      .insert({ id: user.id, email })
      .select("credits_balance,locale,output_language")
      .maybeSingle();

    if (!ins.error && ins.data && typeof (ins.data as any).credits_balance === "number") {
      return {
        creditsBalance: (ins.data as any).credits_balance as number,
        locale: typeof (ins.data as any).locale === "string" ? (ins.data as any).locale : null,
        outputLanguage: typeof (ins.data as any).output_language === "string" ? (ins.data as any).output_language : null,
      };
    }

    const again = await supabase
      .from("profiles")
      .select("credits_balance,locale,output_language")
      .eq("id", user.id)
      .maybeSingle();

    return {
      creditsBalance: typeof (again.data as any)?.credits_balance === "number" ? ((again.data as any).credits_balance as number) : null,
      locale: typeof (again.data as any)?.locale === "string" ? ((again.data as any).locale as string) : null,
      outputLanguage: typeof (again.data as any)?.output_language === "string" ? ((again.data as any).output_language as string) : null,
    };
  } catch (e: any) {
    // During `next build`, Next may attempt static optimization; `cookies()` throws
    // `DYNAMIC_SERVER_USAGE` in that phase. This route is intentionally dynamic.
    const digest = e && typeof e === "object" ? (e as any).digest : undefined;
    if (digest !== "DYNAMIC_SERVER_USAGE") {
      console.error("Unexpected error loading credits_balance", e);
    }
    return { creditsBalance: null, locale: null, outputLanguage: null };
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { creditsBalance, locale, outputLanguage } = await loadProfileSettings();

  return (
    <AppI18nProvider initialLocale={locale} initialOutputLanguage={outputLanguage}>
      <div className="h-dvh aurora-bg overflow-hidden">
        <TelemetryInit />

        <div className="flex h-dvh min-w-0">
          {/* Sidebar: fixed, never scrolls with page */}
          <aside className="hidden md:flex fixed inset-y-0 left-0 w-[280px] z-40 flex-col bg-gradient-to-b from-teal-600 via-cyan-700 to-sky-800 text-white">
            <div className="h-16 px-6 flex items-center justify-between">
              <Link href="/app/jobs" className="font-semibold text-lg tracking-tight">
                TenderPilot
              </Link>
            </div>

            <Separator className="bg-white/15" />

            {/* Nav scrolls only inside sidebar, footer pinned */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto">
                <SideNav />
              </div>

              <SidebarFooter creditsBalance={creditsBalance} />
            </div>
          </aside>

          {/* Main column: only this scrolls */}
          <div className="flex min-w-0 flex-1 flex-col md:pl-[280px]">
            <AppHeader creditsBalance={creditsBalance} />

            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
              <div className="mx-auto max-w-7xl">
                <AuthGate>{children}</AuthGate>
              </div>
            </main>
          </div>
        </div>
      </div>
    </AppI18nProvider>
  );
}