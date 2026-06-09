import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches backend JWT default

export function staffTokenCookieOptions(maxAge = MAX_AGE): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure: process.env.NODE_ENV === "production",
  };
}

export function clearStaffTokenCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  };
}
