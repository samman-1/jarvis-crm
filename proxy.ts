import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALES, isLocale } from "@/lib/i18n/config";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

/**
 * Two jobs:
 *   1. Make sure every URL carries a locale segment (/en/… or /ar/…).
 *   2. Keep anyone without a valid session on the login page.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const segments = pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];

  // No locale in the path — send them to one, preferring their browser's.
  if (!maybeLocale || !isLocale(maybeLocale)) {
    const accept = request.headers.get("accept-language") ?? "";
    const preferred = accept.toLowerCase().startsWith("ar")
      ? "ar"
      : DEFAULT_LOCALE;
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = maybeLocale;
  const rest = `/${segments.slice(1).join("/")}`;
  const isLoginPage = rest === "/login" || rest === "/login/";

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    // Remember where they were headed so login can send them back.
    url.search = pathname === `/${locale}` ? "" : `?next=${pathname}${search}`;
    return NextResponse.redirect(url);
  }

  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the auth API and static files.
     * The web manifest and icons must be excluded explicitly — otherwise the
     * locale redirect rewrites them to /en/manifest.webmanifest and the phone
     * cannot install the app.
     */
    "/((?!_next/static|_next/image|api/auth|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

export const LOCALE_LIST = LOCALES;
