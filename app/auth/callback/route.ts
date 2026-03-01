import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const NEXT_COOKIE = "tp_next";

function safeNextPath(v: unknown) {
  const raw = typeof v === "string" ? v : "";
  if (!raw || !raw.startsWith("/")) return "/app/jobs";
  if (raw.startsWith("//")) return "/app/jobs";
  return raw;
}

function normalizeOtpType(raw: string | null) {
  const v = String(raw ?? "").trim();
  // Supabase Email OTP types (keep a conservative allow-list)
  if (v === "magiclink") return "magiclink";
  if (v === "signup") return "signup";
  if (v === "recovery") return "recovery";
  if (v === "invite") return "invite";
  if (v === "email_change") return "email_change";
  return "magiclink";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = normalizeOtpType(url.searchParams.get("type"));

  const nextFromQuery = url.searchParams.get("next");
  let next = safeNextPath(nextFromQuery);

  if (!nextFromQuery) {
    const c = req.cookies.get(NEXT_COOKIE)?.value;
    if (c) {
      try {
        next = safeNextPath(decodeURIComponent(c));
      } catch {
        next = safeNextPath(c);
      }
    }
  }

  // If neither PKCE code nor token hash is present, send user to login.
  if (!code && !token_hash) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set(NEXT_COOKIE, "", { path: "/", maxAge: 0 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Required so the browser client can read the auth cookies.
            res.cookies.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL("/login", url.origin));
    }
    return res;
  }

  // token_hash flow (fallback / legacy)
  const { error } = await supabase.auth.verifyOtp({
    type: type as any,
    token_hash: String(token_hash),
  });

  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  return res;
}
