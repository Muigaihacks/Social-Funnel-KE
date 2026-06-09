import { cookies } from "next/headers";
import { backendBaseUrl } from "@/lib/backend";
import { STAFF_TOKEN_COOKIE } from "@/lib/staff-auth-cookie";

export async function staffFetch(path: string, init?: RequestInit): Promise<Response | null> {
  const token = (await cookies()).get(STAFF_TOKEN_COOKIE)?.value;
  if (!token) return null;
  return fetch(`${backendBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}
