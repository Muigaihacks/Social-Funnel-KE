"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordInput } from "@/components/PasswordInput";
import Link from "next/link";

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [pending, setPending] = useState(false);

  if (!token) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <p className="text-sm text-semantic-danger">Invalid or missing reset token.</p>
        <Link href="/admin/forgot-password" className="mt-4 inline-block text-xs text-[var(--sf-teal)] hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    
    try {
      const r = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Failed to reset password");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Could not reach the server. Check that the API is running.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Password updated</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Your password has been successfully set.</p>
        <Link 
          href="/admin/login" 
          className="mt-6 inline-block w-full rounded-full bg-[var(--sf-teal)] py-2.5 text-sm font-semibold text-sf-off hover:opacity-90"
        >
          Go to login
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Set new password</h2>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Choose a strong password (min 8 characters).</p>
      </div>

      <label className="block text-xs font-medium text-[var(--text-muted)]">
        New Password
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          wrapperClassName="mt-1.5"
          className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--input-bg)] px-3 py-2.5 text-sm text-[var(--foreground)] focus:border-sf-teal/50 focus:outline-none"
        />
      </label>

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
        {pending ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
