import Link from "next/link";
import { Suspense } from "react";
import { SocialFunnelLogoMark } from "@/components/SocialFunnelLogoMark";
import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.12),transparent)]"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <SocialFunnelLogoMark className="h-14 w-14 text-[var(--sf-teal)]" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--foreground)]">Acquisition OS</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Social Funnel · internal dashboard</p>
        </div>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-[var(--card-surface)]" />}>
          <AdminLoginForm />
        </Suspense>

        <p className="mt-8 text-center text-[11px] text-[var(--text-faint)]">
          Staff accounts are managed under{" "}
          <Link href="/admin" className="text-[var(--sf-teal)] hover:underline">
            Administration
          </Link>{" "}
          after sign-in. First-time server setup: see{" "}
          <code className="rounded bg-[var(--chart-grid)] px-1">docs/STAFF_AUTH.md</code>.
        </p>
      </div>
    </main>
  );
}
