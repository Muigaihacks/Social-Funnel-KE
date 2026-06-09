import { NextResponse } from "next/server";
import { backendBaseUrl } from "@/lib/backend";
import { STAFF_TOKEN_COOKIE } from "@/lib/staff-auth-cookie";
import { staffTokenCookieOptions } from "@/lib/staff-cookie-options";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const token = (await cookies()).get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${backendBaseUrl()}/api/v1/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok?: boolean; token?: string; user?: unknown; error?: string };

  if (!res.ok || !data.ok || !data.token) {
    return NextResponse.json(
      { ok: false, error: data.error ?? "Failed to change password" },
      { status: res.status >= 400 ? res.status : 400 }
    );
  }

  const out = NextResponse.json({ ok: true, user: data.user });
  out.cookies.set(STAFF_TOKEN_COOKIE, data.token, staffTokenCookieOptions());
  return out;
}
