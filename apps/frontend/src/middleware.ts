import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { STAFF_TOKEN_COOKIE } from "@/lib/staff-auth-cookie";

/** Paths reachable without a staff session cookie */
const PUBLIC_EXACT = new Set(["/login", "/forgot-password", "/reset-password"]);

const PUBLIC_PREFIXES = ["/api/auth/", "/_next/", "/favicon", "/apple-touch-icon"];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(STAFF_TOKEN_COOKIE)?.value;

  if (isPublicPath(pathname)) {
    if (token && pathname === "/login") {
      const next = request.nextUrl.searchParams.get("next");
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") {
      login.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
