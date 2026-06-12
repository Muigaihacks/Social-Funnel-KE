import Link from "next/link";
import { Suspense } from "react";
import { SocialFunnelLogoMark } from "@/components/SocialFunnelLogoMark";
import AdminLoginForm from "./AdminLoginForm";

export default function AdminLoginPage() {
  const env = process.env.NEXT_PUBLIC_ENV || process.env.NODE_ENV;
  const isProduction = env === "production";
  const envLabel = isProduction ? "Production" : "Staging";
  const envColor = isProduction ? "bg-semantic-success/15 text-semantic-success border-semantic-success/30" : "bg-semantic-warning/15 text-semantic-warning border-semantic-warning/30";

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(45,212,191,0.12),transparent)]"
        aria-hidden
      />

      {/* Environment Badge */}
      <div className="absolute right-4 top-4 md:right-8 md:top-8">
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium backdrop-blur-sm ${envColor}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
          {envLabel}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-full bg-[var(--sf-teal)]/20 blur-2xl" />
            <SocialFunnelLogoMark className="relative h-16 w-16 text-[var(--sf-teal)]" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-[var(--foreground)]">Acquisition OS</h1>
          <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">Social Funnel · Internal Dashboard</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-faint)]">
            <div className="h-px w-8 bg-[var(--card-border)]" />
            <span>Secure Access Portal</span>
            <div className="h-px w-8 bg-[var(--card-border)]" />
          </div>
        </div>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-[var(--card-surface)]" />}>
          <AdminLoginForm />
        </Suspense>

        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--text-faint)]">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              256-bit Encryption
            </span>
            <span className="h-3 w-px bg-[var(--card-border)]" />
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              SOC 2 Compliant
            </span>
          </div>
          <p className="text-center text-[11px] leading-relaxed text-[var(--text-faint)]">
            Staff accounts are managed under{" "}
            <Link href="/admin" className="text-[var(--sf-teal)] hover:underline">
              Administration
            </Link>{" "}
            after sign-in.
            <br />
            First-time setup: see{" "}
            <code className="rounded bg-[var(--chart-grid)] px-1">docs/STAFF_AUTH.md</code>
          </p>
        </div>
      </div>
    </main>
  );
}
