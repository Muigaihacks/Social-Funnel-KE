import Link from "next/link";

export default function LeadNotFound() {
  return (
    <main className="min-h-screen px-4 pb-16 md:px-8">
      <div className="mx-auto max-w-lg py-24 text-center">
        <h1 className="text-xl font-semibold text-[var(--foreground)]">Lead not found</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">That id does not exist or was removed.</p>
        <Link href="/leads" className="mt-6 inline-block text-sm text-sf-teal hover:underline">
          ← Back to Lead Profiles
        </Link>
      </div>
    </main>
  );
}
