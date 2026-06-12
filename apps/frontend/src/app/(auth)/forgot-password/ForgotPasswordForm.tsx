"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    
    try {
      const r = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string; message?: string };
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Failed to request password reset");
        return;
      }
      setSuccess(data.message ?? "If that email exists, a reset link has been sent.");
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
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Reset password</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Enter your email to receive a reset link.</p>
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

      {error ? (
        <p className="rounded-xl border border-semantic-danger/40 bg-semantic-danger/10 px-3 py-2 text-xs text-[var(--foreground)]">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-xl border border-semantic-success/40 bg-semantic-success/10 px-3 py-2 text-xs text-[var(--foreground)]">
          {success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-[var(--sf-teal)] py-2.5 text-sm font-semibold text-sf-off hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Sending..." : "Send reset link"}
      </button>

      <div className="text-center mt-4">
        <Link href="/admin/login" className="text-xs text-[var(--sf-teal)] hover:underline">
          Back to login
        </Link>
      </div>
    </form>
  );
}
