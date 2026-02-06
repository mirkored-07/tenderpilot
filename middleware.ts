import { NextResponse, type NextRequest } from "next/server";

const LOCALE_COOKIE = "tp_locale";
const SUPPORTED = ["en", "de", "it", "es", "fr"] as const;
type Locale = (typeof SUPPORTED)[number];

function isSupportedLocale(v: string | undefined | null): v is Locale {
  return !!v && (SUPPORTED as readonly string[]).includes(v);
}

// Default is EN. Cookie overrides if user selected a language.
function detectLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isSupportedLocale(cookie)) return cookie;
  return "en";
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

    // Do NOT apply locale logic to auth/app routes
  if (
    pathname.startsWith("/app") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth")
  ) {
    return NextResponse.next();
  }

  // If user visits /{locale} directly, remember it
  const firstSeg = pathname.split("/")[1];
  if (isSupportedLocale(firstSeg)) {
    const res = NextResponse.next();
    res.cookies.set(LOCALE_COOKIE, firstSeg, { path: "/", sameSite: "lax" });
    return res;
  }

  // Redirect root to locale (default: en)
  if (pathname === "/") {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/en/:path*",
    "/de/:path*",
    "/it/:path*",
    "/es/:path*",
    "/fr/:path*",
    ],
};
