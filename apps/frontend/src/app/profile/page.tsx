import Link from "next/link";
import { redirect } from "next/navigation";
import { staffFetch } from "@/lib/admin-fetch";

export const metadata = {
  title: "My Profile | Social Funnel",
};

export default async function ProfilePage() {
  const meRes = await staffFetch("/api/v1/auth/me");
  if (!meRes?.ok) redirect("/admin/login");

  const meJson = (await meRes.json()) as {
    user: { id: string; email: string; name: string | null; roleKey: string; roleLabel: string; permissions: string[] };
  };

  const { user } = meJson;
  const initial = user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase();

  return (
    <main className="min-h-screen px-4 pb-20 pt-28 md:px-8 md:pt-32">
      <div className="mx-auto max-w-lg">
        <header className="mb-8 border-b border-[var(--card-border)] pb-6">
          <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">My Profile</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">View your account details and role.</p>
        </header>

        <section className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--sf-teal)]/10 text-3xl font-bold text-[var(--sf-teal)]">
              {initial}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--foreground)]">{user.name || "No name set"}</h2>
            <p className="text-sm text-[var(--text-muted)]">{user.email}</p>
            
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--input-bg)] px-4 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-semantic-success"></span>
              <span className="font-medium capitalize text-[var(--foreground)]">{user.roleLabel}</span>
              <span className="text-[var(--text-muted)]">({user.roleKey})</span>
            </div>
          </div>

          <div className="mt-8 space-y-4 border-t border-[var(--card-border)] pt-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Account Security</h3>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-[var(--foreground)]">Password</span>
                <Link
                  href="/admin/change-password"
                  className="rounded-full border border-[var(--card-border)] px-4 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--chart-grid)]"
                >
                  Change password
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
