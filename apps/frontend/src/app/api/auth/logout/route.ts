import { NextResponse } from "next/server";
import { STAFF_TOKEN_COOKIE } from "@/lib/staff-auth-cookie";
import { clearStaffTokenCookieOptions } from "@/lib/staff-cookie-options";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(STAFF_TOKEN_COOKIE, "", clearStaffTokenCookieOptions());
  return res;
}
