import Link from "next/link";
import { CreateLeadForm } from "./CreateLeadForm";

export default function NewLeadPage() {
  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 border-b border-[var(--card-border)] pb-6">
          <p className="mb-2">
            <Link href="/leads" className="text-sm text-sf-teal hover:underline">
              ← Lead profiles
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)] md:text-3xl">Add lead</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Creates a new pipeline entry at stage <strong className="text-[var(--text-soft)]">new</strong>. If phone or email
            already exists, we update the existing profile (same rules as form ingest).
          </p>
        </header>

        <CreateLeadForm />
      </div>
    </main>
  );
}
