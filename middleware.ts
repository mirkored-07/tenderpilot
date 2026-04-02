import { NextResponse, type NextRequest } from "next/server";

// Minimal proxy (Next 16+ replacement for middleware.ts)
// Keeps routing stable on Vercel Edge. Auth/session is handled by:
// - /auth/callback (sets cookies)
// - client-side supabaseBrowser() refresh

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/en";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: request.headers },
  });
}

export const config = {
  matcher: ["/", "/app/:path*", "/login"],
};
