import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Keeps the Supabase session cookies fresh on navigations and SSR requests.
// NOTE: Cookie mutation is allowed here, but NOT in Server Components.

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnon) return response;

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // IMPORTANT: keep cookies readable by the browser Supabase client
          // so client-side RLS writes keep working.
          // Also attempt to reflect cookies into the in-flight request so
          // downstream Server Components see the refreshed session on the same request.
          try {
            (request as any).cookies?.set?.(name, value);
          } catch {
            // ignore
          }
          response.cookies.set(name, value, { ...options, httpOnly: false });
        });
      },
    },
  });

  // This refreshes the session if needed and writes back updated cookies.
  // Do not block if it fails.
  try {
    await supabase.auth.getUser();
  } catch {
    // ignore
  }

  return response;
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
