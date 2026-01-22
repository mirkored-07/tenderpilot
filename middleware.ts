import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();

  // Any /app/* route is not available on the public marketing site
  url.pathname = "/";
  url.searchParams.set("from", "app");

  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*"],
};
