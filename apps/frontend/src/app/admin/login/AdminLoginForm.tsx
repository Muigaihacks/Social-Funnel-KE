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
      className="space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Sign in</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Use your staff email and password.</p>
      </div>

      <label className="block text-xs font-medium text-[var(--text-muted)]">
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="username"
          autoFocus
          className="mt-1.5 w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--text-faint)] focus:border-sf-teal/50 focus:outline-none"
          placeholder="you@socialfunnel.agency"
        />
      </label>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[var(--text-muted)]">
          Password
          <PasswordInput
            name="password"
            required
            autoComplete="current-password"
            wrapperClassName="mt-1.5"
            className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
          />
        </label>
        <div className="text-right">
          <a href="/admin/forgot-password" className="text-xs text-[var(--sf-teal)] hover:underline">
            Forgot your password?
          </a>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 px-3 py-2 text-xs text-[var(--foreground)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--sf-teal)] py-2.5 text-sm font-semibold text-sf-off hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
