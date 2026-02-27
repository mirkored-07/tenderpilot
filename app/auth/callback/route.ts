import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const NEXT_COOKIE = "tp_next";

function safeNextPath(v: unknown) {
  const raw = typeof v === "string" ? v : "";
  if (!raw || !raw.startsWith("/")) return "/app/jobs";
  if (raw.startsWith("//")) return "/app/jobs";
  return raw;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
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

  if (!code) {
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
            res.cookies.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  return res;
}