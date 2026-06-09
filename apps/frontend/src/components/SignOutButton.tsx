"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={pending}
      className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--chart-grid)] hover:text-[var(--foreground)] disabled:opacity-50"
    >
      {pending ? "…" : "Sign out"}
    </button>
  );
}
