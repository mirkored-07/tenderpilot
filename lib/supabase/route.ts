import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client for App Router route handlers.
 *
 * This repo already standardizes on @supabase/ssr (see auth callback + server actions).
 */
export function supabaseRoute(req: NextRequest, res?: NextResponse) {
  const response = res ?? NextResponse.next();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, { ...options, httpOnly: false });
          });
        },
      },
    }
  );
}
