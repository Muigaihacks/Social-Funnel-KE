import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/admin-fetch";

export default async function AdminMainLayout({ children }: { children: React.ReactNode }) {
  const meRes = await staffFetch("/api/v1/auth/me");
  if (!meRes?.ok) redirect("/admin/login");
  const body = (await meRes.json()) as { user?: { mustChangePassword?: boolean } };
  if (body.user?.mustChangePassword) redirect("/admin/change-password");
  return children;
}
