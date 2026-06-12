import Link from "next/link";
import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/admin-fetch";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AdminChangePasswordPage() {
  const meRes = await staffFetch("/api/v1/auth/me");
  if (!meRes?.ok) redirect("/admin/login");
  const meJson = (await meRes.json()) as { user: { mustChangePassword: boolean } };

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 pb-20 md:px-8">
      <ChangePasswordForm forced={meJson.user.mustChangePassword} />
      {meJson.user.mustChangePassword ? (
        <p className="mt-6 max-w-sm text-center text-[10px] text-[var(--text-faint)]">
          You must finish this step before opening other admin pages.
        </p>
      ) : null}
      {!meJson.user.mustChangePassword ? (
        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          <Link href="/" className="text-[var(--sf-teal)] hover:underline">
            ← Dashboard
          </Link>
        </p>
      ) : null}
    </main>
  );
}
