"use client";

import { PasswordInput } from "@/components/PasswordInput";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get("currentPassword") ?? "");
    const newPassword = String(fd.get("newPassword") ?? "");
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-sm space-y-4 rounded-2xl border border-[var(--card-border)] bg-[var(--card-surface)] p-6"
    >
      <h1 className="text-lg font-semibold text-[var(--foreground)]">
        {forced ? "Set your password" : "Change password"}
      </h1>
      {forced ? (
        <p className="text-xs text-[var(--text-muted)]">
          Sign in with your temporary password, then choose a new one here. It updates immediately for future logins.
        </p>
      ) : (
        <p className="text-xs text-[var(--text-muted)]">Enter your current password and a new password (min 8 characters).</p>
      )}
      <label className="block text-xs text-[var(--text-muted)]">
        Current password
        <PasswordInput name="currentPassword" required autoComplete="current-password" />
      </label>
      <label className="block text-xs text-[var(--text-muted)]">
        New password
        <PasswordInput name="newPassword" required minLength={8} autoComplete="new-password" />
      </label>
      {error ? <p className="text-xs text-semantic-danger">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full border border-[var(--sf-teal)]/50 bg-[var(--sf-teal)]/15 py-2 text-sm font-medium text-[var(--sf-teal)] disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
      {!forced ? (
        <p className="text-center text-xs text-[var(--text-muted)]">
          <Link href="/admin" className="text-[var(--sf-teal)] hover:underline">
            ← Back to admin
          </Link>
        </p>
      ) : null}
    </form>
  );
}
