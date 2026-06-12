"use client";

import { PasswordInput } from "@/components/PasswordInput";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; user?: { mustChangePassword?: boolean } };
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Invalid email or password");
        return;
      }
      if (data.user?.mustChangePassword) {
        router.push("/admin/change-password");
      } else {
        const dest =
          nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") && nextPath !== "/admin/login"
            ? nextPath
            : "/";
        router.push(dest);
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check that the API is running.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative space-y-5 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8"
    >
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-[var(--sf-teal)]/5 via-transparent to-transparent" />
      
      <div className="relative">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Sign in</h2>
        <p className="mt-1.5 text-xs text-[var(--text-muted)]">Access your staff dashboard securely</p>
      </div>

      <div className="relative space-y-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            autoFocus
            className="mt-2 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] shadow-sm placeholder:text-[var(--text-faint)] transition-colors focus:border-[var(--sf-teal)] focus:ring-2 focus:ring-[var(--sf-teal)]/20 focus:outline-none"
            placeholder="you@socialfunnel.agency"
          />
        </label>

        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            Password
            <PasswordInput
              name="password"
              required
              autoComplete="current-password"
              wrapperClassName="mt-2"
              className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-4 py-3 text-sm text-[var(--foreground)] shadow-sm transition-colors focus:border-[var(--sf-teal)] focus:ring-2 focus:ring-[var(--sf-teal)]/20 focus:outline-none"
            />
          </label>
          <div className="text-right">
            <a href="/admin/forgot-password" className="text-xs font-medium text-[var(--sf-teal)] hover:underline">
              Forgot your password?
            </a>
          </div>
        </div>
      </div>

      {error ? (
        <div className="relative rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 px-4 py-3 text-xs">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-semantic-danger" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-[var(--foreground)]">{error}</p>
          </div>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="relative w-full overflow-hidden rounded-full bg-[var(--sf-teal)] py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="relative z-10">{pending ? "Authenticating…" : "Continue"}</span>
        {pending && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
      </button>
    </form>
  );
}
